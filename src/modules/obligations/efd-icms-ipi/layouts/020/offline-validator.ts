import { type OfflineValidationIssue, type ValidationContext } from "./field-definition";
import { BLOCK_ORDER, blockOf, getRecordDef, RECORDS } from "./records";

export interface OfflineValidationInput {
  /** Linhas do arquivo EFD (já divididas, sem o \r\n). */
  lines: string[];
  context?: ValidationContext;
}

interface ParsedLine {
  raw: string;
  code: string;
  fields: string[];
  index: number; // 0-based entre as linhas não vazias
}

function parseLines(lines: string[]): ParsedLine[] {
  const out: ParsedLine[] = [];
  let index = 0;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const fields = raw.split("|");
    const code = (fields[1] ?? "").trim();
    if (!code) continue;
    out.push({ raw, code, fields, index });
    index++;
  }
  return out;
}

/** Checa hierarquia/ordem dos abridores de bloco (0000 < B < C < ... < 9001). */
function checkBlockOrder(parsed: ParsedLine[]): OfflineValidationIssue[] {
  const issues: OfflineValidationIssue[] = [];
  const order = BLOCK_ORDER as readonly string[];
  const seen = parsed
    .filter((p) => (order as readonly string[]).includes(p.code))
    .map((p) => ({ code: p.code, idx: p.index }));
  let lastRank = -1;
  for (const s of seen) {
    const rank = order.indexOf(s.code as (typeof BLOCK_ORDER)[number]);
    if (rank < lastRank) {
      issues.push({
        severity: "error",
        recordCode: s.code,
        line: s.idx + 1,
        rule: "EFD_BLOCK_ORDER",
        message: `Abridor de bloco ${s.code} fora de ordem (Guia).`,
      });
    }
    lastRank = Math.max(lastRank, rank);
  }
  return issues;
}

/** Coleta cadastros (0150/0200/0400) e verifica referências dos documentos. */
function checkCrossReferences(parsed: ParsedLine[]): OfflineValidationIssue[] {
  const issues: OfflineValidationIssue[] = [];
  const parts = new Set<string>();
  const items = new Set<string>();
  const nats = new Set<string>();
  const usedPart = new Set<string>();
  const usedItem = new Set<string>();
  const usedNat = new Set<string>();

  for (const p of parsed) {
    if (p.code === "0150") parts.add(p.fields[2] ?? "");
    if (p.code === "0200") items.add(p.fields[2] ?? "");
    if (p.code === "0400") nats.add(p.fields[2] ?? "");
  }

  for (const p of parsed) {
    if (p.code === "C100") {
      const cod = p.fields[4] ?? "";
      if (cod && !parts.has(cod)) {
        issues.push({
          severity: "error", recordCode: "C100", field: "COD_PART", line: p.index + 1,
          rule: "EFD_XREF_COD_PART", message: `C100 referencia COD_PART ${cod} ausente em 0150.`,
        });
      } else if (cod) usedPart.add(cod);
    }
    if (p.code === "C170") {
      const codItem = p.fields[3] ?? "";
      const codNat = p.fields[12] ?? "";
      if (codItem && !items.has(codItem)) {
        issues.push({
          severity: "error", recordCode: "C170", field: "COD_ITEM", line: p.index + 1,
          rule: "EFD_XREF_COD_ITEM", message: `C170 referencia COD_ITEM ${codItem} ausente em 0200.`,
        });
      } else if (codItem) usedItem.add(codItem);
      if (codNat && !nats.has(codNat)) {
        issues.push({
          severity: "error", recordCode: "C170", field: "COD_NAT", line: p.index + 1,
          rule: "EFD_XREF_COD_NAT", message: `C170 referencia COD_NAT ${codNat} ausente em 0400.`,
        });
      } else if (codNat) usedNat.add(codNat);
    }
  }

  // Órfãos (cadastro não referenciado) — o PVA trata como erro.
  for (const p of parsed) {
    if (p.code === "0150" && !usedPart.has(p.fields[2] ?? "")) {
      issues.push({
        severity: "error", recordCode: "0150", field: "COD_PART", line: p.index + 1,
        rule: "EFD_ORPHAN_0150", message: `0150 (${p.fields[2]}) não referenciado por nenhum C100.`,
      });
    }
    if (p.code === "0200" && !usedItem.has(p.fields[2] ?? "")) {
      issues.push({
        severity: "error", recordCode: "0200", field: "COD_ITEM", line: p.index + 1,
        rule: "EFD_ORPHAN_0200", message: `0200 (${p.fields[2]}) não referenciado por nenhum C170.`,
      });
    }
    if (p.code === "0400" && !usedNat.has(p.fields[2] ?? "")) {
      issues.push({
        severity: "error", recordCode: "0400", field: "COD_NAT", line: p.index + 1,
        rule: "EFD_ORPHAN_0400", message: `0400 (${p.fields[2]}) não referenciado por nenhum C170.`,
      });
    }
  }
  return issues;
}

/** Valida contadores de fechamento: *990 por bloco e 9999 total. */
function checkCounters(parsed: ParsedLine[]): OfflineValidationIssue[] {
  const issues: OfflineValidationIssue[] = [];
  const counts: Record<string, number> = {};
  for (const p of parsed) {
    const b = blockOf(p.code);
    counts[b] = (counts[b] ?? 0) + 1;
  }
  const total = parsed.length;
  for (const p of parsed) {
    if (p.code.endsWith("990")) {
      const expected = p.code === "9990"
        ? (counts["9"] ?? 0)
        : counts[blockOf(p.code)] ?? 0;
      const got = parseInt((p.fields[2] ?? "0").replace(/\D/g, ""), 10);
      if (got !== expected) {
        issues.push({
          severity: "error", recordCode: p.code, line: p.index + 1,
          rule: "EFD_COUNTER",
          message: `${p.code} QTD_LIN=${got} diverge do total real ${expected}.`,
        });
      }
    }
    if (p.code === "9999") {
      const got = parseInt((p.fields[2] ?? "0").replace(/\D/g, ""), 10);
      if (got !== total) {
        issues.push({
          severity: "error", recordCode: "9999", line: p.index + 1,
          rule: "EFD_COUNTER_9999",
          message: `9999 QTD_LIN=${got} diverge do total de linhas ${total}.`,
        });
      }
    }
  }
  return issues;
}

/** Valida contagem de campos e enumerações de cada registro contra o leiaute. */
function checkFields(parsed: ParsedLine[], ctx: ValidationContext): OfflineValidationIssue[] {
  const issues: OfflineValidationIssue[] = [];
  for (const p of parsed) {
    const def = getRecordDef(p.code);
    if (!def) continue; // registro fora do leiaute 020 conhecido — ignorado
    const got = p.fields.length - 2; // fields[0] e fields[último] são vazios (wrapper |...|)
    if (got !== def.fields.length) {
      issues.push({
        severity: "error", recordCode: p.code, line: p.index + 1, rule: "EFD_FIELD_COUNT",
        message: `${p.code} tem ${got} campos; leiaute espera ${def.fields.length}.`,
      });
      continue;
    }
    for (const fdef of def.fields) {
      if (fdef.position === 1) continue; // REG
      const value = p.fields[fdef.position] ?? "";
      if (fdef.required && !value.trim()) {
        issues.push({
          severity: "error", recordCode: p.code, field: fdef.name, line: p.index + 1,
          rule: "EFD_REQUIRED_FIELD", message: `${p.code}.${fdef.name} obrigatório vazio.`,
        });
      }
      if (fdef.allowedValues && value.trim() && !fdef.allowedValues.includes(value.trim())) {
        issues.push({
          severity: "error", recordCode: p.code, field: fdef.name, line: p.index + 1,
          rule: "EFD_ENUM",
          message: `${p.code}.${fdef.name}=${value} inválido (esperado ${fdef.allowedValues.join("/")}).`,
        });
      }
    }
  }
  return issues;
}

export function validateEfdOffline(
  input: OfflineValidationInput,
): OfflineValidationIssue[] {
  const ctx: ValidationContext = input.context ?? {};
  const parsed = parseLines(input.lines);
  const issues: OfflineValidationIssue[] = [
    ...checkFields(parsed, ctx),
    ...checkBlockOrder(parsed),
    ...checkCrossReferences(parsed),
    ...checkCounters(parsed),
  ];
  return issues;
}

export { RECORDS };
