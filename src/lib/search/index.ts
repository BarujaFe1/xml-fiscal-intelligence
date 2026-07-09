import type { BatchStore, SearchResult } from "@/types";

export function searchBatchStore(
  store: BatchStore,
  query: string,
  options?: {
    documentType?: string;
    limit?: number;
  },
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const limit = options?.limit ?? 50;
  const results: SearchResult[] = [];

  const typeFilter = options?.documentType;

  for (const d of store.documents) {
    if (typeFilter && d.documentType !== typeFilter) continue;
    const haystacks: Array<{ field: string; value?: string }> = [
      { field: "accessKey", value: d.accessKey },
      { field: "number", value: d.number },
      { field: "emitterDoc", value: d.emitterDoc },
      { field: "emitterName", value: d.emitterName },
      { field: "receiverDoc", value: d.receiverDoc },
      { field: "receiverName", value: d.receiverName },
      { field: "fileName", value: d.fileName },
      { field: "protocol", value: d.protocol },
      { field: "status", value: d.status },
    ];

    let matched = haystacks.find((h) => h.value?.toLowerCase().includes(q));
    if (!matched) {
      for (const [path, value] of Object.entries(d.flattenedJson)) {
        if (String(value ?? "")
          .toLowerCase()
          .includes(q)) {
          matched = { field: path, value: String(value) };
          break;
        }
      }
    }

    if (matched) {
      results.push({
        kind: "document",
        documentId: d.id,
        batchId: d.batchId,
        documentType: d.documentType,
        title: `${d.documentType} ${d.number || d.accessKey || d.fileName}`,
        subtitle: d.emitterName,
        matchedField: matched.field,
        preview: matched.value,
        totalValue: d.totalValue,
        issueDate: d.issueDate,
        emitterName: d.emitterName,
        receiverName: d.receiverName,
      });
    }
    if (results.length >= limit) return results;
  }

  for (const item of store.items) {
    if (results.length >= limit) break;
    const doc = store.documents.find((d) => d.id === item.documentId);
    if (!doc) continue;
    if (typeFilter && doc.documentType !== typeFilter) continue;
    const blob = [item.code, item.description, item.ncm, item.cfop, item.unit]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!blob.includes(q)) continue;
    results.push({
      kind: "item",
      documentId: item.documentId,
      batchId: item.batchId,
      documentType: item.documentType,
      title: item.description || item.code || `Item ${item.itemNumber}`,
      subtitle: `Item #${item.itemNumber} · ${doc.number || doc.fileName}`,
      matchedField: item.ncm?.toLowerCase().includes(q)
        ? "ncm"
        : item.cfop?.toLowerCase().includes(q)
          ? "cfop"
          : "description",
      preview: item.description,
      totalValue: item.totalValue,
      issueDate: doc.issueDate,
      emitterName: doc.emitterName,
      receiverName: doc.receiverName,
    });
  }

  for (const field of store.fields) {
    if (results.length >= limit) break;
    if (typeFilter && field.documentType !== typeFilter) continue;
    const text = field.valueText?.toLowerCase() || "";
    if (!text.includes(q) && !field.pathNormalized.toLowerCase().includes(q)) continue;
    const doc = store.documents.find((d) => d.id === field.documentId);
    results.push({
      kind: "field",
      documentId: field.documentId,
      batchId: field.batchId,
      documentType: field.documentType,
      title: field.pathNormalized,
      subtitle: doc ? `${doc.documentType} ${doc.number || ""}` : undefined,
      matchedField: field.pathNormalized,
      preview: field.valueText,
      totalValue: doc?.totalValue,
      issueDate: doc?.issueDate,
      emitterName: doc?.emitterName,
      receiverName: doc?.receiverName,
    });
  }

  return results.slice(0, limit);
}

export function searchAllStores(stores: BatchStore[], query: string, limit = 50): SearchResult[] {
  const all: SearchResult[] = [];
  for (const store of stores) {
    const part = searchBatchStore(store, query, { limit: limit - all.length });
    all.push(...part);
    if (all.length >= limit) break;
  }
  return all;
}
