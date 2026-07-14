/**
 * Import de tabelas dinâmicas / planos referenciais — versionado, sem hardcode gigante.
 */

import type { ReferentialTableVersion } from "@/modules/ecf/types";

/** CSV oficial reducido: code;name */
export function parseReferentialCsv(
  csv: string,
  meta: {
    workspaceId: string;
    tableCode: string;
    versionLabel: string;
    effectiveFrom: string;
    effectiveTo?: string;
    sourceFileName?: string;
  },
): ReferentialTableVersion {
  const entries: Array<{ code: string; name: string }> = [];
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^code[;,\t]/i.test(line) || /^codigo/i.test(line)) continue;
    const parts = line.split(/[;,\t]/);
    const code = (parts[0] || "").trim();
    const name = (parts[1] || code).trim();
    if (!code) continue;
    entries.push({ code, name });
  }
  return {
    id: `ref_${meta.tableCode}_${meta.versionLabel}_${Date.now()}`,
    workspaceId: meta.workspaceId,
    tableCode: meta.tableCode,
    versionLabel: meta.versionLabel,
    effectiveFrom: meta.effectiveFrom,
    effectiveTo: meta.effectiveTo,
    entries,
    sourceFileName: meta.sourceFileName,
    importedAt: new Date().toISOString(),
  };
}

export function pickReferentialForPeriod(
  tables: ReferentialTableVersion[],
  periodStart: string,
  tableCode?: string,
): ReferentialTableVersion | null {
  const day = periodStart.slice(0, 10);
  const candidates = tables
    .filter((t) => !tableCode || t.tableCode === tableCode)
    .filter((t) => t.effectiveFrom <= day && (!t.effectiveTo || t.effectiveTo >= day));
  candidates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return candidates[0] || null;
}

export const REFERENTIAL_CSV_TEMPLATE = `code;name
1.01.01;Caixa e equivalentes — exemplo import
2.01.01;Fornecedores — exemplo import
`;
