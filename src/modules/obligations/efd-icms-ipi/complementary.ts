/**
 * EFD complementary data — CSV templates for accountant-supplied fields.
 * Never invents balances or adjustments.
 */

export type ComplementaryKind =
  | "accountant"
  | "opening_balance"
  | "adjustments"
  | "inventory";

export const COMPLEMENTARY_TEMPLATES: Record<
  ComplementaryKind,
  { headers: string[]; sample: string[][]; disclaimer: string }
> = {
  accountant: {
    headers: ["nome", "cpf", "crc", "email", "fone"],
    sample: [["Maria Contadora", "00000000000", "SP-000000/O-0", "", ""]],
    disclaimer: "Dados do contabilista — responsabilidade do usuário; não inferidos do XML.",
  },
  opening_balance: {
    headers: ["periodo", "vl_sld_credor_ant", "uf", "observacao"],
    sample: [["2026-02", "0,00", "SP", "Informar saldo E110 anterior"]],
    disclaimer: "Saldo anterior não pode ser inventado a partir de XML do período.",
  },
  adjustments: {
    headers: ["codigo_ajuste", "descricao", "valor", "base_legal"],
    sample: [["SP000001", "Exemplo — substituir", "0,00", ""]],
    disclaimer: "Códigos de ajuste estaduais devem vir de tabela oficial da UF.",
  },
  inventory: {
    headers: ["cod_item", "descricao", "qtd", "vl_unit", "vl_item"],
    sample: [["SKU1", "Item inventário", "0", "0,00", "0,00"]],
    disclaimer: "Inventário (bloco H) exige origem contábil/estoque — não gerado só de NF-e.",
  },
};

export function buildComplementaryCsv(kind: ComplementaryKind): string {
  const t = COMPLEMENTARY_TEMPLATES[kind];
  const lines = [t.headers.join(";")];
  for (const row of t.sample) lines.push(row.join(";"));
  return lines.join("\n");
}

export function parseComplementaryCsv(text: string): {
  headers: string[];
  rows: string[][];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0]!.split(";").map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(";").map((c) => c.trim()));
  return { headers, rows };
}

export function validateComplementaryPreview(
  kind: ComplementaryKind,
  headers: string[],
): { ok: boolean; messages: string[] } {
  const expected = COMPLEMENTARY_TEMPLATES[kind].headers;
  const missing = expected.filter((h) => !headers.includes(h));
  if (missing.length) {
    return { ok: false, messages: [`Colunas ausentes: ${missing.join(", ")}`] };
  }
  return { ok: true, messages: ["Estrutura OK — revise valores antes de usar na geração."] };
}
