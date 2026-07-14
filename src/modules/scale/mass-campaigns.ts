/**
 * Campanhas massivas validated_scope — multi-UF, fila re-lab, cobertura.
 * Nunca promove OBLIGATION_SUPPORT_PROFILES global.
 */

import type { ValidatedScenario } from "@/modules/homologation/types";
import { cellMaturityFromScenario } from "@/modules/homologation/scenarios";
import { checkRehomologation } from "@/modules/continuous-ops/rehomologation";
import type { MarketplaceListing } from "@/modules/enterprise/types";
import type { CoverageCell, MassCampaign } from "@/modules/scale/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export function createMassCampaign(input: {
  tenantId: string;
  workspaceId: string;
  title: string;
  obligationId: ObligationId;
  targetUfs: string[];
  targetRegime?: string;
  listingIds?: string[];
  notes?: string;
}): MassCampaign {
  if (input.targetUfs.length === 0) throw new Error("targetUfs obrigatório");
  const now = new Date().toISOString();
  return {
    id: `mass_${input.obligationId}_${Date.now()}`,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    title: input.title,
    obligationId: input.obligationId,
    targetUfs: [...new Set(input.targetUfs.map((u) => u.toUpperCase()))],
    targetRegime: input.targetRegime,
    listingIds: input.listingIds || [],
    scenarioIds: [],
    status: "planned",
    relabQueue: [],
    createdAt: now,
    updatedAt: now,
    notes: input.notes,
  };
}

/** Anexa listings do marketplace do mesmo tenant e enfileira re-lab. */
export function enqueueFromMarketplace(
  camp: MassCampaign,
  listings: MarketplaceListing[],
): MassCampaign {
  const mine = listings.filter(
    (l) =>
      l.tenantId === camp.tenantId &&
      l.status === "published" &&
      l.obligationId === camp.obligationId &&
      (!l.uf || camp.targetUfs.includes(l.uf.toUpperCase())),
  );
  const listingIds = [...new Set([...camp.listingIds, ...mine.map((m) => m.id)])];
  const relabQueue = [...new Set([...camp.relabQueue, ...mine.map((m) => m.id)])];
  return {
    ...camp,
    listingIds,
    relabQueue,
    status: relabQueue.length ? "queued_relab" : camp.status,
    updatedAt: new Date().toISOString(),
  };
}

export function attachScenarioIds(camp: MassCampaign, scenarioIds: string[]): MassCampaign {
  return {
    ...camp,
    scenarioIds: [...new Set([...camp.scenarioIds, ...scenarioIds])],
    status: camp.status === "planned" || camp.status === "queued_relab" ? "in_progress" : camp.status,
    updatedAt: new Date().toISOString(),
  };
}

export function popRelabQueue(camp: MassCampaign): { camp: MassCampaign; listingId?: string } {
  if (camp.relabQueue.length === 0) return { camp };
  const [listingId, ...rest] = camp.relabQueue;
  return {
    listingId,
    camp: {
      ...camp,
      relabQueue: rest,
      status: rest.length ? "queued_relab" : "in_progress",
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Completa só se cobertura mínima de UFs com célula validated_scope.
 * Nunca altera maturidade global da obrigação.
 */
export function tryCompleteMassCampaign(
  camp: MassCampaign,
  scenarios: ValidatedScenario[],
  minUfsWithValidatedScope = 1,
): MassCampaign {
  const attached = scenarios.filter(
    (s) => camp.scenarioIds.includes(s.id) && s.obligationId === camp.obligationId,
  );
  const ufsOk = new Set(
    attached
      .filter((s) => cellMaturityFromScenario(s) === "validated_scope")
      .map((s) => (s.uf || "BR").toUpperCase())
      .filter((u) => camp.targetUfs.includes(u)),
  );
  if (ufsOk.size < minUfsWithValidatedScope) {
    return {
      ...camp,
      status: "blocked",
      notes: `${camp.notes || ""} | UFs validated_scope=${[...ufsOk].join(",") || "nenhuma"} < ${minUfsWithValidatedScope}`,
      updatedAt: new Date().toISOString(),
    };
  }
  return { ...camp, status: "completed", updatedAt: new Date().toISOString() };
}

export function buildCoverageDashboard(
  scenarios: ValidatedScenario[],
  opts?: { now?: Date },
): CoverageCell[] {
  const map = new Map<string, CoverageCell>();
  for (const s of scenarios) {
    const uf = (s.uf || "BR").toUpperCase();
    const regime = s.regime || "-";
    const key = `${s.obligationId}|${uf}|${regime}`;
    const row = map.get(key) || {
      obligationId: s.obligationId,
      uf,
      regime,
      validatedScopeCount: 0,
      pendingRelab: 0,
      rehomologationDue: 0,
    };
    const mat = cellMaturityFromScenario(s);
    if (mat === "validated_scope") row.validatedScopeCount += 1;
    if (s.status === "lab_pending" || s.status === "blocked_missing_lab") row.pendingRelab += 1;
    const check = checkRehomologation(s, { now: opts?.now });
    if (check.expired || check.action === "retest_lab") row.rehomologationDue += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) =>
    `${a.obligationId}${a.uf}`.localeCompare(`${b.obligationId}${b.uf}`),
  );
}

export function aggregateSection28Campaign(
  camp: MassCampaign,
  scenarios: ValidatedScenario[],
): string {
  const attached = scenarios.filter((s) => camp.scenarioIds.includes(s.id));
  const lines = [
    `# §28 agregado — ${camp.title}`,
    "",
    `- campaignId: ${camp.id}`,
    `- obligation: ${camp.obligationId}`,
    `- UFs alvo: ${camp.targetUfs.join(", ")}`,
    `- status: ${camp.status}`,
    `- cenários: ${attached.length}`,
    "",
    "## Células",
  ];
  for (const s of attached) {
    lines.push(
      `- ${s.id} uf=${s.uf || "BR"} maturity=${cellMaturityFromScenario(s) || "n/a"} status=${s.status}`,
    );
  }
  lines.push("", "_Não promove maturidade global da obrigação._", "");
  return lines.join("\n");
}
