/**
 * Gerações imutáveis + retificação = nova versão + diff.
 */

import type { ImmutableGeneration } from "@/modules/ops/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export function createGeneration(input: {
  workspaceId: string;
  companyId: string;
  obligationId: ObligationId;
  periodKey: string;
  contentHash: string;
  layoutVersion: string;
  contentPreview?: string;
  createdBy?: string;
  previous?: ImmutableGeneration | null;
}): ImmutableGeneration {
  if (input.previous && !input.previous.locked) {
    throw new Error("versão anterior deve estar locked antes da retificação");
  }
  const version = input.previous ? input.previous.version + 1 : 1;
  return {
    id: `gen_${input.obligationId}_${input.periodKey}_v${version}_${input.contentHash.slice(0, 8)}`,
    workspaceId: input.workspaceId,
    companyId: input.companyId,
    obligationId: input.obligationId,
    periodKey: input.periodKey,
    version,
    rectifiesId: input.previous?.id,
    contentHash: input.contentHash,
    layoutVersion: input.layoutVersion,
    contentPreview: input.contentPreview?.slice(0, 2000),
    locked: true,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
}

export type GenerationDiff = {
  sameHash: boolean;
  hashBefore?: string;
  hashAfter: string;
  previewLinesAdded: number;
  previewLinesRemoved: number;
  impactSummary: string;
};

export function diffGenerations(
  before: ImmutableGeneration | null,
  after: ImmutableGeneration,
): GenerationDiff {
  if (!before) {
    return {
      sameHash: false,
      hashAfter: after.contentHash,
      previewLinesAdded: (after.contentPreview || "").split("\n").length,
      previewLinesRemoved: 0,
      impactSummary: `Nova geração v${after.version} · hash ${after.contentHash.slice(0, 12)}`,
    };
  }
  const a = new Set((before.contentPreview || "").split("\n").filter(Boolean));
  const b = new Set((after.contentPreview || "").split("\n").filter(Boolean));
  let added = 0;
  let removed = 0;
  for (const line of b) if (!a.has(line)) added += 1;
  for (const line of a) if (!b.has(line)) removed += 1;
  const sameHash = before.contentHash === after.contentHash;
  return {
    sameHash,
    hashBefore: before.contentHash,
    hashAfter: after.contentHash,
    previewLinesAdded: added,
    previewLinesRemoved: removed,
    impactSummary: sameHash
      ? "Hashes idênticos — retificação sem mudança de conteúdo"
      : `Retificação v${before.version}→v${after.version}: +${added}/-${removed} linhas preview · hash ${before.contentHash.slice(0, 8)}→${after.contentHash.slice(0, 8)}`,
  };
}
