/**
 * Generic CSV/JSON importers for accounting (ERP connector foundation).
 */

import type { ChartAccount, JournalEntry, JournalLine } from "@/modules/accounting/types";

export type ImportPreview = {
  ok: boolean;
  messages: string[];
  accounts: ChartAccount[];
  entries: JournalEntry[];
};

function splitCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[;,]/).map((c) => c.trim()));
}

/** Headers: code;name;level;nature;kind;parent */
export function parseChartCsv(
  text: string,
  meta: { workspaceId: string; companyId: string },
): ChartAccount[] {
  const rows = splitCsv(text);
  if (!rows.length) return [];
  const start = /code|codigo|código/i.test(rows[0]![0] || "") ? 1 : 0;
  const now = new Date().toISOString();
  const out: ChartAccount[] = [];
  for (const r of rows.slice(start)) {
    if (r.length < 5) continue;
    const [code, name, level, nature, kind, parent] = r;
    out.push({
      id: `acc_${meta.companyId}_${code}`,
      workspaceId: meta.workspaceId,
      companyId: meta.companyId,
      code: code!,
      name: name || code!,
      level: Number(level) || 1,
      nature: (nature as ChartAccount["nature"]) || "01",
      kind: kind === "synthetic" || kind === "S" ? "synthetic" : "analytic",
      parentCode: parent || undefined,
      effectiveFrom: now.slice(0, 10),
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  return out;
}

/** Headers: date;batch;account;side;amount;history */
export function parseJournalCsv(
  text: string,
  meta: { workspaceId: string; companyId: string; idempotencyPrefix?: string },
): JournalEntry[] {
  const rows = splitCsv(text);
  if (!rows.length) return [];
  const start = /date|data/i.test(rows[0]![0] || "") ? 1 : 0;
  const groups = new Map<string, { date: string; batch: string; lines: JournalLine[] }>();
  let i = 0;
  for (const r of rows.slice(start)) {
    if (r.length < 5) continue;
    const [date, batch, account, side, amount, history] = r;
    const key = `${date}|${batch}`;
    const g = groups.get(key) || { date: date!, batch: batch || "IMP", lines: [] };
    g.lines.push({
      id: `ln_${i++}`,
      accountCode: account!,
      side: side?.toUpperCase() === "C" ? "C" : "D",
      amount: amount || "0",
      history,
    });
    groups.set(key, g);
  }
  const now = new Date().toISOString();
  const prefix = meta.idempotencyPrefix || "csv";
  return [...groups.entries()].map(([key, g], idx) => ({
    id: `je_${prefix}_${idx}_${key.replace(/\W/g, "_")}`,
    workspaceId: meta.workspaceId,
    companyId: meta.companyId,
    batchLabel: g.batch,
    entryDate: g.date,
    status: "draft" as const,
    lines: g.lines,
    origin: "import_csv" as const,
    idempotencyKey: `${prefix}:${key}`,
    createdAt: now,
    updatedAt: now,
  }));
}

export function parseLedgerJson(
  raw: unknown,
  meta: { workspaceId: string; companyId: string },
): ImportPreview {
  const messages: string[] = [];
  const accounts: ChartAccount[] = [];
  const entries: JournalEntry[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, messages: ["JSON inválido"], accounts, entries };
  }
  const obj = raw as { accounts?: unknown[]; entries?: unknown[] };
  const now = new Date().toISOString();
  if (Array.isArray(obj.accounts)) {
    for (const a of obj.accounts) {
      const row = a as Partial<ChartAccount>;
      if (!row.code || !row.name) {
        messages.push("conta sem code/name ignorada");
        continue;
      }
      accounts.push({
        id: row.id || `acc_${meta.companyId}_${row.code}`,
        workspaceId: meta.workspaceId,
        companyId: meta.companyId,
        code: row.code,
        name: row.name,
        level: row.level || 1,
        nature: row.nature || "01",
        kind: row.kind || "analytic",
        parentCode: row.parentCode,
        referentialCode: row.referentialCode,
        effectiveFrom: row.effectiveFrom || now.slice(0, 10),
        effectiveTo: row.effectiveTo,
        active: row.active !== false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  if (Array.isArray(obj.entries)) {
    for (const e of obj.entries) {
      const row = e as Partial<JournalEntry>;
      if (!row.entryDate || !row.lines?.length) {
        messages.push("lançamento incompleto ignorado");
        continue;
      }
      entries.push({
        id: row.id || `je_json_${Math.random().toString(36).slice(2, 8)}`,
        workspaceId: meta.workspaceId,
        companyId: meta.companyId,
        batchLabel: row.batchLabel || "JSON",
        entryDate: row.entryDate,
        status: "draft",
        lines: row.lines,
        origin: "import_json",
        idempotencyKey: row.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return { ok: true, messages, accounts, entries };
}

export const CHART_CSV_TEMPLATE =
  "code;name;level;nature;kind;parent\n1;ATIVO;1;01;synthetic;\n1.1.01;Caixa;3;01;analytic;1\n2;PASSIVO;1;02;synthetic;\n2.1.01;Fornecedores;3;02;analytic;2\n";

export const JOURNAL_CSV_TEMPLATE =
  "date;batch;account;side;amount;history\n2026-01-15;L1;1.1.01;D;1000,00;Abertura\n2026-01-15;L1;2.1.01;C;1000,00;Abertura\n";
