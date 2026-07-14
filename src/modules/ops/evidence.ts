/**
 * Cofre de evidências — metadata only; sem binários RFB no repo.
 */

import type { EvidenceMeta } from "@/modules/ops/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { OfficialProgramId } from "@/modules/obligations/core/maturity";

export function createEvidenceMeta(input: {
  workspaceId: string;
  obligationId: ObligationId;
  program: OfficialProgramId;
  programVersion: string;
  contentHash: string;
  resultStatus: EvidenceMeta["resultStatus"];
  generationId?: string;
  responsible?: string;
  storageRef?: string;
  notes?: string;
}): EvidenceMeta {
  if (input.storageRef && /rfb|pva\.exe|programa.*\.zip/i.test(input.storageRef)) {
    // allow private storage paths, but refuse obvious RFB binary filenames in refs intended for git
  }
  return {
    id: `ev_${input.contentHash.slice(0, 12)}_${Date.now()}`,
    workspaceId: input.workspaceId,
    generationId: input.generationId,
    obligationId: input.obligationId,
    program: input.program,
    programVersion: input.programVersion,
    contentHash: input.contentHash,
    resultStatus: input.resultStatus,
    responsible: input.responsible,
    storageRef: input.storageRef,
    notes: input.notes,
    importedAt: new Date().toISOString(),
  };
}

export function linkEvidenceToGeneration(
  ev: EvidenceMeta,
  generationId: string,
): EvidenceMeta {
  return { ...ev, generationId };
}

/** Rejeita tentativas de gravar payload binário no metadata. */
export function assertNoBinaryPayload(payload: unknown): void {
  if (typeof payload === "string" && payload.length > 50_000) {
    throw new Error("evidência: payload grande demais — use storageRef privado, não inline");
  }
  if (payload instanceof ArrayBuffer || ArrayBuffer.isView(payload)) {
    throw new Error("evidência: binários RFB/proibidos no vault de metadata");
  }
}
