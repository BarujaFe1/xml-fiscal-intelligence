/**
 * Campanhas de expansão validated_scope — por célula, não global.
 */

import type { ValidatedScenario } from "@/modules/homologation/types";
import { cellMaturityFromScenario } from "@/modules/homologation/scenarios";
import { checkRehomologation } from "@/modules/continuous-ops/rehomologation";
import type {
  CellDashboardRow,
  ValidatedScopeCampaign,
} from "@/modules/governance/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export function createCampaign(input: {
  workspaceId: string;
  title: string;
  obligationId: ObligationId;
  targetUf?: string;
  targetRegime?: string;
  scenarioIds?: string[];
  notes?: string;
  revalidationDueAt?: string;
}): ValidatedScopeCampaign {
  const now = new Date().toISOString();
  return {
    id: `camp_${input.obligationId}_${Date.now()}`,
    workspaceId: input.workspaceId,
    title: input.title,
    obligationId: input.obligationId,
    targetUf: input.targetUf,
    targetRegime: input.targetRegime,
    status: "planned",
    scenarioIds: input.scenarioIds || [],
    revalidationDueAt: input.revalidationDueAt,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export function advanceCampaignStatus(
  camp: ValidatedScopeCampaign,
  to: ValidatedScopeCampaign["status"],
): ValidatedScopeCampaign {
  if (camp.status === "cancelled" || camp.status === "completed") {
    throw new Error("campanha encerrada");
  }
  if (to === "completed" && camp.scenarioIds.length === 0) {
    throw new Error("completed exige scenarioIds com pacote §28");
  }
  return { ...camp, status: to, updatedAt: new Date().toISOString() };
}

export function attachScenariosToCampaign(
  camp: ValidatedScopeCampaign,
  scenarioIds: string[],
): ValidatedScopeCampaign {
  const set = new Set([...camp.scenarioIds, ...scenarioIds]);
  return {
    ...camp,
    scenarioIds: [...set],
    status: camp.status === "planned" ? "in_progress" : camp.status,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Só completa se TODOS os cenários anexados estão validated_scope_ready.
 * Nunca promove OBLIGATION_SUPPORT_PROFILES global.
 */
export function tryCompleteCampaign(
  camp: ValidatedScopeCampaign,
  scenarios: ValidatedScenario[],
): ValidatedScopeCampaign {
  const attached = scenarios.filter((s) => camp.scenarioIds.includes(s.id));
  if (attached.length === 0) {
    throw new Error("nenhum cenário anexado");
  }
  const missing = attached.filter((s) => cellMaturityFromScenario(s) !== "validated_scope");
  if (missing.length > 0) {
    return {
      ...camp,
      status: "blocked",
      notes: `${camp.notes || ""} | pendentes: ${missing.map((m) => m.id).join(",")}`,
      updatedAt: new Date().toISOString(),
    };
  }
  return { ...camp, status: "completed", updatedAt: new Date().toISOString() };
}

export function buildCellDashboard(
  scenarios: ValidatedScenario[],
  opts?: { now?: Date; maxAgeDays?: number },
): CellDashboardRow[] {
  return scenarios.map((s) => {
    const check = checkRehomologation(s, {
      now: opts?.now,
      maxAgeDays: opts?.maxAgeDays ?? 90,
    });
    return {
      obligationId: s.obligationId,
      uf: s.uf || "BR",
      regime: s.regime || "-",
      scenarioId: s.id,
      cellMaturity: cellMaturityFromScenario(s) || "n/a",
      status: s.status,
      reviewedAt: s.reviewedAt,
      rehomologationDue: check.expired || check.action === "retest_lab",
    };
  });
}

export const PRIORITY_CAMPAIGN_SEEDS: Array<{
  title: string;
  obligationId: ObligationId;
  notes: string;
}> = [
  {
    title: "ICMS/IPI · PVA por UF piloto",
    obligationId: "efd-icms-ipi",
    notes: "Campanha — exigir evidência PVA + §28 antes de célula validated_scope",
  },
  {
    title: "EFD-Contribuições · PGE",
    obligationId: "efd-contribuicoes",
    notes: "Campanha — evidência PGE por cenário",
  },
];
