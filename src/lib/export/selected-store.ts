import type { BatchStore } from "@/types";
import { sumDocumentValues } from "@/lib/analytics";

export type SelectedBatchStoreResult = {
  store: BatchStore;
  requestedIds: string[];
  missingIds: string[];
  selectedCount: number;
};

/**
 * Pure view of a BatchStore limited to the selected document IDs.
 * Does not mutate the original store.
 *
 * Relationship policy: keep a relationship only when BOTH sides are in the selection
 * (avoids orphan edges that would imply documents outside the export).
 */
export function buildSelectedBatchStore(
  store: BatchStore,
  selectedDocumentIds: Iterable<string>,
): SelectedBatchStoreResult {
  const requestedIds = [...new Set(selectedDocumentIds)];
  const requested = new Set(requestedIds);
  const documents = store.documents.filter((d) => requested.has(d.id));
  const foundIds = new Set(documents.map((d) => d.id));
  const missingIds = requestedIds.filter((id) => !foundIds.has(id));

  const items = store.items.filter((i) => foundIds.has(i.documentId));
  const fields = store.fields.filter((f) => foundIds.has(f.documentId));
  const fileNames = new Set(documents.map((d) => d.fileName));
  const errors = store.errors.filter((e) => fileNames.has(e.fileName));
  const findings = (store.findings || []).filter(
    (f) => !f.documentId || foundIds.has(f.documentId),
  );
  const relationships = (store.relationships || []).filter(
    (r) => foundIds.has(r.sourceDocumentId) && foundIds.has(r.targetDocumentId),
  );

  const countType = (t: string) => documents.filter((d) => d.documentType === t).length;
  const totalValue = sumDocumentValues(documents);
  const validXml = documents.filter((d) => d.parseStatus !== "error").length;
  const invalidXml = documents.length - validXml;
  const duplicateCount = documents.filter((d) => d.isDuplicate).length;

  const selectedStore: BatchStore = {
    ...store,
    batch: {
      ...store.batch,
      totalXml: documents.length,
      validXml,
      invalidXml,
      nfeCount: countType("NFE") + countType("NFCE"),
      cteCount: countType("CTE"),
      nfseCount: countType("NFSE"),
      unknownCount:
        countType("UNKNOWN") +
        countType("EVENT") +
        countType("CANCELATION") +
        countType("CORRECTION_LETTER"),
      duplicateCount,
      totalValue,
      newDocumentCount: documents.length,
    },
    documents,
    items,
    fields,
    errors,
    findings,
    relationships,
    // Keep original reuse lineage out of selection exports — not part of the selection.
    reusedDocuments: [],
    exports: [],
  };

  return {
    store: selectedStore,
    requestedIds,
    missingIds,
    selectedCount: documents.length,
  };
}
