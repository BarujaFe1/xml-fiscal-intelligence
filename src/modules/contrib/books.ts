/**
 * Livros auxiliares PIS/COFINS a partir do domínio.
 */

import type { ContribBookLine, ContribEntry, ContribSnapshot } from "@/modules/contrib/types";

function parseAmt(s?: string): number {
  if (!s) return 0;
  return Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
}

export function buildContribBooks(snap: ContribSnapshot): ContribBookLine[] {
  const kinds = new Map<ContribBookLine["kind"], ContribBookLine>();
  for (const e of snap.entries) {
    if (e.periodKey !== snap.periodKey && e.mode === "current_fact_generation") continue;
    // historical mode: include all entries for the company snapshot period filter externally
    const cur = kinds.get(e.kind) || {
      kind: e.kind,
      amount: 0,
      count: 0,
      creditExplicitOnly: e.kind === "credit",
    };
    cur.amount += parseAmt(e.amount);
    cur.count += 1;
    if (e.kind === "credit" && !e.creditExplicit) {
      cur.creditExplicitOnly = false;
    }
    kinds.set(e.kind, cur);
  }
  return [...kinds.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

/** Rejeita créditos não explícitos (inventados). */
export function findIllicitCredits(entries: ContribEntry[]): ContribEntry[] {
  return entries.filter((e) => e.kind === "credit" && !e.creditExplicit);
}

export function sumByKind(
  entries: ContribEntry[],
  kind: ContribEntry["kind"],
): number {
  return entries.filter((e) => e.kind === kind).reduce((a, e) => a + parseAmt(e.amount), 0);
}
