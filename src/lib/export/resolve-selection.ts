import type { Batch, BatchStore, DocumentSummary } from "@/types";

export type ResolvedMultiSelection = {
  store: BatchStore;
  documentIds: string[];
  missingCompositeIds: string[];
  batchCount: number;
};

function parseSelectionId(raw: string): { batchId?: string; documentId: string } {
  const idx = raw.indexOf(":");
  if (idx <= 0) return { documentId: raw };
  return { batchId: raw.slice(0, idx), documentId: raw.slice(idx + 1) };
}

function emptyBatch(partial: Partial<Batch> & { id: string; name: string }): Batch {
  const now = new Date().toISOString();
  return {
    id: partial.id,
    workspaceId: partial.workspaceId || "ws_local",
    name: partial.name,
    uploadedFileName: partial.uploadedFileName || "",
    status: partial.status || "completed",
    totalFiles: partial.totalFiles ?? 0,
    totalXml: partial.totalXml ?? 0,
    validXml: partial.validXml ?? 0,
    invalidXml: partial.invalidXml ?? 0,
    nfeCount: partial.nfeCount ?? 0,
    cteCount: 0,
    nfseCount: 0,
    unknownCount: 0,
    duplicateCount: 0,
    totalValue: partial.totalValue ?? 0,
    healthScore: partial.healthScore ?? null,
    progress: 100,
    progressMessage: partial.progressMessage || "",
    createdAt: partial.createdAt || now,
    updatedAt: now,
    month: partial.month,
    year: partial.year,
  };
}

/**
 * Resolve multilote selection (`batchId:documentId` or bare documentId) into a
 * single BatchStore suitable for buildExportDataset / runSelectionExport.
 */
export function resolveSelectionAcrossStores(
  stores: BatchStore[],
  selectionIds: Iterable<string>,
): ResolvedMultiSelection {
  const byBatch = new Map(stores.map((s) => [s.batch.id, s]));
  const foundDocs: DocumentSummary[] = [];
  const foundIds: string[] = [];
  const missingCompositeIds: string[] = [];
  const batchIds = new Set<string>();
  const seenDoc = new Set<string>();

  for (const raw of selectionIds) {
    const { batchId, documentId } = parseSelectionId(raw);
    let store: BatchStore | undefined;
    if (batchId) store = byBatch.get(batchId);
    else if (stores.length === 1) store = stores[0];
    else {
      const hits = stores.filter((s) => s.documents.some((d) => d.id === documentId));
      store = hits.length === 1 ? hits[0] : undefined;
    }
    const doc = store?.documents.find((d) => d.id === documentId);
    if (!store || !doc) {
      missingCompositeIds.push(raw);
      continue;
    }
    const key = `${store.batch.id}:${doc.id}`;
    if (seenDoc.has(key)) continue;
    seenDoc.add(key);
    batchIds.add(store.batch.id);
    foundDocs.push(doc);
    foundIds.push(doc.id);
  }

  const primary = stores[0];
  const names = [...batchIds].map((id) => byBatch.get(id)?.batch.name || id);
  const docIdSet = new Set(foundIds);
  const items = stores.flatMap((s) => s.items.filter((i) => docIdSet.has(i.documentId)));
  const findings = stores.flatMap((s) =>
    (s.findings || []).filter((f) => !f.documentId || docIdSet.has(f.documentId)),
  );
  const relationships = stores.flatMap((s) => s.relationships || []);
  const fields = stores.flatMap((s) => s.fields.filter((f) => docIdSet.has(f.documentId)));

  const store: BatchStore = {
    batch: emptyBatch({
      ...(primary?.batch || {}),
      id:
        batchIds.size === 1
          ? [...batchIds][0]!
          : `multi:${[...batchIds].sort().join("+").slice(0, 80)}`,
      name:
        batchIds.size <= 1
          ? names[0] || primary?.batch.name || "Seleção"
          : `Multilote (${batchIds.size} lotes): ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`,
      validXml: foundDocs.length,
      totalXml: foundDocs.length,
      nfeCount: foundDocs.filter((d) => d.documentType === "NFE").length,
      totalValue: foundDocs.reduce((a, d) => a + (d.totalValue || 0), 0),
      status: "completed",
    }),
    documents: foundDocs,
    items,
    findings,
    relationships,
    fields,
    errors: [],
    exports: [],
  };

  return {
    store,
    documentIds: foundIds,
    missingCompositeIds,
    batchCount: batchIds.size,
  };
}
