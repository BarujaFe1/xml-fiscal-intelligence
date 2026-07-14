/**
 * e-Lalur / e-Lacs — modelo Parte A/B + diff entre versões.
 */

import type { ElalurPartALine, ElalurPartBBalance, ElalurSnapshot } from "@/modules/ecf/types";

export function emptyElalur(meta: {
  workspaceId: string;
  companyId: string;
  periodKey: string;
  version?: number;
}): ElalurSnapshot {
  const now = new Date().toISOString();
  return {
    id: `elalur_${meta.companyId}_${meta.periodKey}_v${meta.version ?? 1}`,
    workspaceId: meta.workspaceId,
    companyId: meta.companyId,
    periodKey: meta.periodKey,
    version: meta.version ?? 1,
    partA: [],
    partB: [],
    locked: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function sumPartA(partA: ElalurPartALine[]): {
  additions: number;
  exclusions: number;
  compensations: number;
} {
  let additions = 0;
  let exclusions = 0;
  let compensations = 0;
  for (const l of partA) {
    const n = Number(String(l.amount).replace(/\./g, "").replace(",", ".")) || 0;
    if (l.kind === "addition") additions += n;
    else if (l.kind === "exclusion") exclusions += n;
    else compensations += n;
  }
  return { additions, exclusions, compensations };
}

export type ElalurDiff = {
  partAAdded: ElalurPartALine[];
  partARemoved: ElalurPartALine[];
  partAChanged: Array<{ before: ElalurPartALine; after: ElalurPartALine }>;
  partBAdded: ElalurPartBBalance[];
  partBRemoved: ElalurPartBBalance[];
  impactSummary: string;
};

export function diffElalur(before: ElalurSnapshot, after: ElalurSnapshot): ElalurDiff {
  const aBefore = new Map(before.partA.map((l) => [l.id, l]));
  const aAfter = new Map(after.partA.map((l) => [l.id, l]));
  const partAAdded = after.partA.filter((l) => !aBefore.has(l.id));
  const partARemoved = before.partA.filter((l) => !aAfter.has(l.id));
  const partAChanged: ElalurDiff["partAChanged"] = [];
  for (const [id, b] of aBefore) {
    const a = aAfter.get(id);
    if (!a) continue;
    if (a.amount !== b.amount || a.kind !== b.kind || a.accountCode !== b.accountCode) {
      partAChanged.push({ before: b, after: a });
    }
  }

  const bBefore = new Map(before.partB.map((l) => [l.id, l]));
  const bAfter = new Map(after.partB.map((l) => [l.id, l]));
  const partBAdded = after.partB.filter((l) => !bBefore.has(l.id));
  const partBRemoved = before.partB.filter((l) => !bAfter.has(l.id));

  const s0 = sumPartA(before.partA);
  const s1 = sumPartA(after.partA);
  const impactSummary = `Parte A: adições ${s0.additions}→${s1.additions}; exclusões ${s0.exclusions}→${s1.exclusions}; compensações ${s0.compensations}→${s1.compensations}. Parte B: ${before.partB.length}→${after.partB.length} saldos.`;

  return { partAAdded, partARemoved, partAChanged, partBAdded, partBRemoved, impactSummary };
}

export async function hashElalur(snap: ElalurSnapshot): Promise<string> {
  const payload = JSON.stringify({
    periodKey: snap.periodKey,
    version: snap.version,
    partA: snap.partA,
    partB: snap.partB,
  });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
