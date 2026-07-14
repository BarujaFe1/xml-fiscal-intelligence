/**
 * ValidatedScenario — maturidade por célula, não global.
 */

import type { ValidatedScenario, ScenarioPackageStatus } from "@/modules/homologation/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { OfficialProgramId } from "@/modules/obligations/core/maturity";

export function createScenarioDraft(input: {
  workspaceId: string;
  obligationId: ObligationId;
  periodKey: string;
  layoutVersion: string;
  program: OfficialProgramId;
  regime?: string;
  uf?: string;
}): ValidatedScenario {
  const now = new Date().toISOString();
  return {
    id: `scn_${input.obligationId}_${input.periodKey}_${input.uf || "BR"}_${Date.now()}`,
    workspaceId: input.workspaceId,
    obligationId: input.obligationId,
    regime: input.regime,
    uf: input.uf,
    periodKey: input.periodKey,
    layoutVersion: input.layoutVersion,
    program: input.program,
    homologationGrade: false,
    status: "draft",
    cellMaturityTarget: "official_validator_beta",
    createdAt: now,
    updatedAt: now,
  };
}

/** Pacote mínimo para official_validator_beta da célula. */
export function evaluateScenarioPackage(
  scn: ValidatedScenario,
): { status: ScenarioPackageStatus; missing: string[] } {
  const missing: string[] = [];
  if (!scn.contentHash || scn.contentHash.length < 16) missing.push("contentHash");
  if (!scn.programVersion?.trim()) missing.push("programVersion");
  if (!scn.generationId && !scn.evidenceId) missing.push("generationId|evidenceId");
  if (!scn.homologationGrade) missing.push("homologationGrade");

  if (missing.length === 0) {
    if (scn.reviewerId && scn.reviewedAt && scn.section28Notes?.trim()) {
      return { status: "validated_scope_ready", missing: [] };
    }
    return { status: "homologation_grade", missing: scn.reviewerId ? [] : ["human_review"] };
  }
  if (scn.contentHash || scn.programVersion) {
    return { status: "evidence_partial", missing };
  }
  return { status: "lab_pending", missing };
}

export function applyLabResult(
  scn: ValidatedScenario,
  lab: {
    contentHash: string;
    programVersion: string;
    generationId?: string;
    evidenceId?: string;
    homologationGrade: boolean;
  },
): ValidatedScenario {
  const next: ValidatedScenario = {
    ...scn,
    contentHash: lab.contentHash,
    programVersion: lab.programVersion,
    generationId: lab.generationId ?? scn.generationId,
    evidenceId: lab.evidenceId ?? scn.evidenceId,
    homologationGrade: lab.homologationGrade,
    updatedAt: new Date().toISOString(),
    status: "draft",
  };
  if (!lab.homologationGrade) {
    next.status = "blocked_missing_lab";
    return next;
  }
  const ev = evaluateScenarioPackage(next);
  next.status = ev.status;
  if (ev.status === "homologation_grade" || ev.status === "validated_scope_ready") {
    next.cellMaturityTarget =
      ev.status === "validated_scope_ready" ? "validated_scope" : "official_validator_beta";
  }
  return next;
}

export function markReviewed(
  scn: ValidatedScenario,
  reviewerId: string,
  section28Notes: string,
): ValidatedScenario {
  if (!scn.homologationGrade) {
    throw new Error("revisão exige homologationGrade=true");
  }
  const next: ValidatedScenario = {
    ...scn,
    reviewerId,
    reviewedAt: new Date().toISOString(),
    section28Notes,
    updatedAt: new Date().toISOString(),
    status: "reviewed",
  };
  const ev = evaluateScenarioPackage(next);
  next.status = ev.status;
  if (ev.status === "validated_scope_ready") {
    next.cellMaturityTarget = "validated_scope";
  }
  return next;
}

/**
 * Promove maturidade da CÉLULA apenas — não altera OBLIGATION_SUPPORT_PROFILES global.
 * Production nunca é retornado.
 */
export function cellMaturityFromScenario(
  scn: ValidatedScenario,
): "internal_beta" | "official_validator_beta" | "validated_scope" | null {
  if (scn.status === "validated_scope_ready" && scn.homologationGrade && scn.reviewerId) {
    return "validated_scope";
  }
  if (scn.homologationGrade && (scn.status === "homologation_grade" || scn.status === "reviewed")) {
    return "official_validator_beta";
  }
  if (scn.status === "blocked_missing_lab") return null;
  return "internal_beta";
}

export type ScenarioMatrixDiff = {
  added: string[];
  removed: string[];
  upgraded: Array<{ id: string; from: string; to: string }>;
  summary: string;
};

export function diffScenarioMatrix(
  before: ValidatedScenario[],
  after: ValidatedScenario[],
): ScenarioMatrixDiff {
  const b = new Map(before.map((s) => [s.id, s]));
  const a = new Map(after.map((s) => [s.id, s]));
  const added = [...a.keys()].filter((k) => !b.has(k));
  const removed = [...b.keys()].filter((k) => !a.has(k));
  const upgraded: ScenarioMatrixDiff["upgraded"] = [];
  for (const [id, scn] of a) {
    const prev = b.get(id);
    if (!prev) continue;
    if (prev.status !== scn.status) {
      upgraded.push({ id, from: prev.status, to: scn.status });
    }
  }
  return {
    added,
    removed,
    upgraded,
    summary: `+${added.length}/-${removed.length} · ${upgraded.length} status change(s)`,
  };
}
