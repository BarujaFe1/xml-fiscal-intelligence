/**
 * Bridge lab oficial → vault de evidências + cenário.
 */

import type { OfficialValidatorRun } from "@/modules/obligations/core/validators/official-lab";
import { isHomologationGradePvaRun } from "@/modules/obligations/efd-icms-ipi/pva/workflow";
import { createEvidenceMeta } from "@/modules/ops/evidence";
import type { EvidenceMeta } from "@/modules/ops/types";
import type { ValidatedScenario } from "@/modules/homologation/types";
import { applyLabResult } from "@/modules/homologation/scenarios";
import { recordOpsEvent } from "@/modules/ops/telemetry";

export function isHomologationGradeGeneric(run: {
  contentHash?: string;
  programVersion?: string;
  resultStatus?: string;
}): boolean {
  return isHomologationGradePvaRun({
    contentHash: run.contentHash,
    pvaVersion: run.programVersion || "",
    resultStatus: (run.resultStatus as "ok" | "errors" | "warnings" | "unknown") || "unknown",
  });
}

export function bridgeLabRunToEvidence(
  run: OfficialValidatorRun,
  workspaceId: string,
): EvidenceMeta {
  const ev = createEvidenceMeta({
    workspaceId,
    obligationId: run.obligationId,
    program: run.program,
    programVersion: run.programVersion,
    contentHash: run.contentHash || `missing_${run.id}`,
    resultStatus: run.resultStatus,
    generationId: run.generationId,
    responsible: run.responsible,
    storageRef: run.evidencePath || "private://lab/report-meta",
    notes: run.notes,
  });
  recordOpsEvent(
    "lab_import",
    `${run.obligationId} grade=${isHomologationGradeGeneric(run)}`,
  );
  return ev;
}

export function attachLabToScenario(
  scn: ValidatedScenario,
  run: OfficialValidatorRun,
  evidenceId: string,
): ValidatedScenario {
  const grade = isHomologationGradeGeneric(run);
  return applyLabResult(scn, {
    contentHash: run.contentHash || "",
    programVersion: run.programVersion,
    generationId: run.generationId,
    evidenceId,
    homologationGrade: grade,
  });
}
