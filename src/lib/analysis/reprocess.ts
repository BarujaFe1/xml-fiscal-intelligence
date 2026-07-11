/**
 * Re-run audit + quality on an existing store without re-parsing XML.
 * Preserves prior analysisGenerations and creates a child generation.
 */
import { createAnalysisGeneration } from "@/lib/analysis/generation";
import { calculateBatchQuality, QUALITY_FORMULA_VERSION } from "@/lib/quality";
import { runFiscalAudit } from "@/modules/audit/fiscal-audit-engine";
import { buildDocumentRelationships } from "@/modules/relationships";
import type { BatchStore } from "@/types";

export function reprocessAnalysis(store: BatchStore, note?: string): BatchStore {
  const findings = runFiscalAudit({
    batch: store.batch,
    documents: store.documents,
    items: store.items,
  });
  const relationships = buildDocumentRelationships({
    workspaceId: store.batch.workspaceId,
    documents: store.documents,
    items: store.items,
  });
  const quality = calculateBatchQuality(
    store.batch,
    store.documents,
    store.items,
    store.fields,
    store.errors,
    { reusedDocumentCount: store.reusedDocuments?.length || store.batch.skippedDuplicateCount || 0 },
  );
  const parent = store.analysisGenerations?.[store.analysisGenerations.length - 1];
  const generation = createAnalysisGeneration({
    batchId: store.batch.id,
    workspaceId: store.batch.workspaceId,
    documentCount: store.documents.length,
    findingCount: findings.length,
    parentGenerationId: parent?.id,
    qualityFormulaVersion: QUALITY_FORMULA_VERSION,
    note: note || "Reprocessamento de auditoria/qualidade (XML preservado)",
  });

  return {
    ...store,
    findings,
    relationships,
    analysisGenerations: [...(store.analysisGenerations || []), generation],
    batch: {
      ...store.batch,
      healthScore: quality.score,
      quality,
      updatedAt: new Date().toISOString(),
    },
  };
}
