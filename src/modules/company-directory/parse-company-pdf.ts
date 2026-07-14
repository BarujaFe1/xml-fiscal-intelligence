import type { CompanyDirectoryEntry, CompanyDirectoryParseResult } from "./types";

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function normalizeWhitespace(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

const HEADER_LINE =
  /^(clientes|vencimento|cert\.?|cadastrado|status do|certificado|config\.?|de|sa[ií]da|status da|sieg\b|https?:\/\/|hub\.sieg)/i;

const STATUS_LINE =
  /^(no prazo|vencido|sucesso|alerta|n[aã]o\b|sim\b|\d{1,2}\/\d{1,2}\/\d{4})/i;

const FOOTER_LINE = /^\d{1,2}\/\d{1,2}\/\d{4}.*sieg/i;

function isDocLine(line: string): { document: string; kind: "cnpj" | "cpf" } | null {
  const stripped = line.replace(/[.\-\/\s]/g, "");
  if (!/^\d+$/.test(stripped)) return null;
  if (stripped.length === 14) return { document: stripped, kind: "cnpj" };
  if (stripped.length === 11) return { document: stripped, kind: "cpf" };
  return null;
}

function isSkippableLine(line: string): boolean {
  if (!line) return true;
  if (HEADER_LINE.test(line)) return true;
  if (STATUS_LINE.test(line)) return true;
  if (FOOTER_LINE.test(line)) return true;
  if (/^\d+\/\d+$/.test(line)) return true; // page "1/1"
  if (/^[-–—]+$/.test(line)) return true;
  return false;
}

/**
 * Parse text extracted from a SIEG Hub "Clientes" print (name + CNPJ/CPF list).
 * Does not invent IE/endereço — those are not in this PDF layout.
 */
export function parseSiegClientsPdfText(raw: string): CompanyDirectoryParseResult {
  const warnings: string[] = [];
  const entries: CompanyDirectoryEntry[] = [];
  const seen = new Set<string>();

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").trim())
    .filter((l) => l.length > 0);

  let nameBuf: string[] = [];

  const flushSkip = () => {
    nameBuf = [];
  };

  for (const line of lines) {
    if (isSkippableLine(line)) {
      // status lines end a previous company block already flushed on doc line
      continue;
    }

    const doc = isDocLine(line);
    if (doc) {
      const name = normalizeWhitespace(nameBuf.join(" "));
      nameBuf = [];
      if (!name) {
        warnings.push(`Documento ${doc.document} sem nome associado — ignorado`);
        continue;
      }
      const key = `${doc.kind}:${doc.document}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ name, document: doc.document, kind: doc.kind });
      continue;
    }

    // Accumulate multi-line corporate names; reset if we hit another header-ish noise mid-name
    if (HEADER_LINE.test(line) || STATUS_LINE.test(line)) {
      flushSkip();
      continue;
    }
    nameBuf.push(line);
  }

  if (nameBuf.length) {
    warnings.push("Texto residual sem documento no fim do PDF — ignorado");
  }

  return {
    source: entries.length ? "sieg-clients" : "unknown",
    entries,
    warnings,
  };
}

const KV_LABELS: Array<{ keys: RegExp; field: keyof ParsedKv }> = [
  { keys: /^(raz[aã]o\s*social|nome\s*(empresarial|fantasia)?|company\s*name)$/i, field: "name" },
  { keys: /^(cnpj)$/i, field: "cnpj" },
  { keys: /^(cpf)$/i, field: "cpf" },
  { keys: /^(i\.?e\.?|inscri[cç][aã]o\s*estadual)$/i, field: "ie" },
  { keys: /^(uf|estado)$/i, field: "uf" },
  { keys: /^(cep)$/i, field: "cep" },
  { keys: /^(munic[ií]pio|cod[_ ]?mun|c[oó]digo\s*(do\s*)?munic[ií]pio)$/i, field: "codMun" },
  { keys: /^(endere[cç]o|logradouro)$/i, field: "address" },
  { keys: /^(n[uú]mero|n[ºo\.]?)$/i, field: "addressNumber" },
  { keys: /^(bairro)$/i, field: "neighborhood" },
];

type ParsedKv = {
  name?: string;
  cnpj?: string;
  cpf?: string;
  ie?: string;
  uf?: string;
  cep?: string;
  codMun?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
};

export type CompanyDirectoryRichEntry = CompanyDirectoryEntry & Partial<ParsedKv>;

/**
 * Best-effort key:value / "Label  Value" cadastro PDF parse.
 * Used when the PDF is not a SIEG clients list.
 */
export function parseKeyValueCompanyPdfText(raw: string): {
  entry: CompanyDirectoryRichEntry | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const bag: ParsedKv = {};
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const m = line.match(/^([^:=]+)\s*[:：=]\s*(.+)$/);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();
    for (const row of KV_LABELS) {
      if (row.keys.test(label)) {
        (bag as Record<string, string>)[row.field] = value;
        break;
      }
    }
  }

  const cnpj = bag.cnpj ? onlyDigits(bag.cnpj) : "";
  const cpf = bag.cpf ? onlyDigits(bag.cpf) : "";
  if (cnpj.length === 14) {
    return {
      entry: {
        name: bag.name || "Empresa",
        document: cnpj,
        kind: "cnpj",
        ...bag,
        cnpj,
      },
      warnings,
    };
  }
  if (cpf.length === 11) {
    return {
      entry: {
        name: bag.name || "Pessoa",
        document: cpf,
        kind: "cpf",
        ...bag,
        cpf,
      },
      warnings,
    };
  }
  return { entry: null, warnings: ["Nenhum CNPJ/CPF encontrado no formato chave:valor"] };
}

/**
 * Prefer SIEG list parse; fall back to key-value single cadastro.
 */
export function parseCompanyDirectoryPdfText(raw: string): CompanyDirectoryParseResult & {
  rich?: CompanyDirectoryRichEntry | null;
} {
  const sieg = parseSiegClientsPdfText(raw);
  if (sieg.entries.length >= 1) {
    return sieg;
  }
  const kv = parseKeyValueCompanyPdfText(raw);
  if (kv.entry) {
    return {
      source: "key-value",
      entries: [kv.entry],
      warnings: [...sieg.warnings, ...kv.warnings],
      rich: kv.entry,
    };
  }
  return {
    source: "unknown",
    entries: [],
    warnings: [
      ...sieg.warnings,
      ...kv.warnings,
      "Não foi possível extrair empresas deste PDF. Use export «Clientes» do SIEG Hub ou um PDF com CNPJ legível.",
    ],
  };
}

export function formatDocMask(document: string, kind: "cnpj" | "cpf"): string {
  const d = onlyDigits(document);
  if (kind === "cnpj" && d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (kind === "cpf" && d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return d;
}
