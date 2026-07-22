import type { BatchStore, DocumentSummary } from "@/types";
import type { AppliedFacetFilters, FilterDraft, WorkspaceDocument } from "@/lib/documents/workspace-types";
import { selectionId } from "@/lib/documents/workspace-types";
import { moneyAdd, moneyToFixed } from "@/lib/money/decimal";

function partyMatches(
  selectedIds: string[],
  doc: string | undefined,
  name: string | undefined,
): boolean {
  if (!selectedIds.length) return true;
  const norm = (doc || "").replace(/\W/g, "").toUpperCase();
  return selectedIds.some((id) => {
    const parts = id.split(":");
    const kind = parts[0];
    const rest = parts.slice(1).join(":");
    if (kind === "name" || rest.startsWith("name:")) {
      const n = id.includes("name:") ? id.split("name:")[1] : rest;
      return (name || "").trim().toLowerCase() === (n || "").trim().toLowerCase();
    }
    return Boolean(norm) && (id.endsWith(`:${norm}`) || id.includes(`:${norm}`));
  });
}

/**
 * Filter documents across one or more batch stores with faceted semantics:
 * OR within a facet, AND across facets.
 */
export function filterWorkspaceDocuments(
  stores: BatchStore[],
  facets: AppliedFacetFilters,
  committed: Partial<FilterDraft>,
  options?: { workspaceId?: string },
): WorkspaceDocument[] {
  const out: WorkspaceDocument[] = [];
  const q = (committed.freeText || "").trim().toLowerCase();

  for (const store of stores) {
    if (options?.workspaceId && store.batch.workspaceId !== options.workspaceId) continue;
    if (facets.batchIds.length && !facets.batchIds.includes(store.batch.id)) continue;

    const competence =
      store.batch.month && store.batch.year
        ? `${String(store.batch.month).padStart(2, "0")}/${store.batch.year}`
        : undefined;
    const origin = store.batch.syncStatus === "synced" ? "cloud" : "local";
    const itemsByDoc = new Map<string, typeof store.items>();
    for (const item of store.items) {
      const list = itemsByDoc.get(item.documentId) || [];
      list.push(item);
      itemsByDoc.set(item.documentId, list);
    }

    for (const d of store.documents) {
      if (!matchDoc(d, facets, committed, q, itemsByDoc.get(d.id) || [])) continue;
      out.push({
        selectionId: selectionId(store.batch.id, d.id),
        batchId: store.batch.id,
        batchName: store.batch.name,
        competence,
        origin,
        importedAt: store.batch.createdAt,
        document: d,
      });
    }
  }
  return out;
}

function matchDoc(
  d: DocumentSummary,
  facets: AppliedFacetFilters,
  committed: Partial<FilterDraft>,
  q: string,
  items: BatchStore["items"],
): boolean {
  if (facets.documentTypes.length && !facets.documentTypes.includes(d.documentType)) return false;
  if (facets.models.length && !facets.models.includes(d.model || "")) return false;
  if (facets.statuses.length && !facets.statuses.includes(d.status || "")) return false;
  if (facets.ufOrigin.length && !facets.ufOrigin.includes(d.emitterUf || "")) return false;
  if (facets.ufDest.length && !facets.ufDest.includes(d.receiverUf || "")) return false;
  if (facets.natures.length && !facets.natures.includes(d.natureOperation || "")) return false;
  if (
    facets.classifications.length &&
    !facets.classifications.includes(d.operationClassification || "")
  ) {
    return false;
  }
  if (facets.parseStatuses.length && !facets.parseStatuses.includes(d.parseStatus)) return false;
  if (!partyMatches(facets.emitterIds, d.emitterDoc, d.emitterName)) return false;
  if (!partyMatches(facets.receiverIds, d.receiverDoc, d.receiverName)) return false;

  if (facets.cfops.length) {
    const set = new Set(facets.cfops);
    if (!items.some((i) => i.cfop && set.has(i.cfop))) return false;
  }
  if (facets.ncms.length) {
    const set = new Set(facets.ncms);
    if (!items.some((i) => i.ncm && set.has(i.ncm))) return false;
  }
  if (facets.cClassTribs.length) {
    const set = new Set(facets.cClassTribs);
    const hit = Object.entries(d.flattenedJson || {}).some(
      ([k, v]) => /cClassTrib$/i.test(k) && set.has(String(v)),
    );
    if (!hit) return false;
  }

  if (committed.number && !(d.number || "").includes(committed.number)) return false;
  if (committed.series && !(d.series || "").includes(committed.series)) return false;
  if (committed.accessKey && !(d.accessKey || "").includes(committed.accessKey.replace(/\D/g, ""))) {
    return false;
  }
  if (committed.dateFrom && (d.issueDate || "") < committed.dateFrom) return false;
  if (committed.dateTo && (d.issueDate || "").slice(0, 10) > committed.dateTo) return false;
  if (committed.minValue) {
    const min = Number(committed.minValue);
    if (Number.isFinite(min) && (d.totalValue || 0) < min) return false;
  }
  if (committed.maxValue) {
    const max = Number(committed.maxValue);
    if (Number.isFinite(max) && (d.totalValue || 0) > max) return false;
  }

  if (q) {
    const hay = [
      d.accessKey,
      d.number,
      d.emitterName,
      d.receiverName,
      d.emitterDoc,
      d.receiverDoc,
      d.fileName,
      d.natureOperation,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function sumWorkspaceValues(rows: WorkspaceDocument[]): string {
  return moneyToFixed(moneyAdd(...rows.map((r) => r.document.totalValue ?? 0)), 2);
}
