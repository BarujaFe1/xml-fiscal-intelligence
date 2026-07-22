/**
 * Pure document selection helpers — identity is always documentId, never array index.
 */

export type HeaderCheckState = "none" | "some" | "all";

export function selectionHeaderState(
  filteredIds: Iterable<string>,
  selectedIds: ReadonlySet<string>,
): HeaderCheckState {
  let total = 0;
  let hit = 0;
  for (const id of filteredIds) {
    total += 1;
    if (selectedIds.has(id)) hit += 1;
  }
  if (total === 0 || hit === 0) return "none";
  if (hit === total) return "all";
  return "some";
}

export function toggleDocumentSelection(
  selectedIds: ReadonlySet<string>,
  documentId: string,
): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(documentId)) next.delete(documentId);
  else next.add(documentId);
  return next;
}

/** Select every filtered result (not just currently virtualized rows). */
export function selectAllFiltered(
  selectedIds: ReadonlySet<string>,
  filteredIds: Iterable<string>,
): Set<string> {
  const next = new Set(selectedIds);
  for (const id of filteredIds) next.add(id);
  return next;
}

export function deselectFiltered(
  selectedIds: ReadonlySet<string>,
  filteredIds: Iterable<string>,
): Set<string> {
  const filtered = new Set(filteredIds);
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (!filtered.has(id)) next.add(id);
  }
  return next;
}

export function clearSelection(): Set<string> {
  return new Set();
}

export function invertFilteredSelection(
  selectedIds: ReadonlySet<string>,
  filteredIds: Iterable<string>,
): Set<string> {
  const next = new Set(selectedIds);
  for (const id of filteredIds) {
    if (next.has(id)) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** Secondary action for virtualized windows. */
export function selectVisibleOnly(
  selectedIds: ReadonlySet<string>,
  visibleIds: Iterable<string>,
): Set<string> {
  const next = new Set(selectedIds);
  for (const id of visibleIds) next.add(id);
  return next;
}

export function countSelectedOutsideFilter(
  selectedIds: ReadonlySet<string>,
  filteredIds: Iterable<string>,
): number {
  const filtered = new Set(filteredIds);
  let n = 0;
  for (const id of selectedIds) {
    if (!filtered.has(id)) n += 1;
  }
  return n;
}

export function resolveSelectedDocuments<T extends { id: string; totalValue?: number }>(
  documents: T[],
  selectedIds: ReadonlySet<string>,
): { found: T[]; missingIds: string[]; totalValue: number } {
  const byId = new Map(documents.map((d) => [d.id, d]));
  const found: T[] = [];
  const missingIds: string[] = [];
  let totalValue = 0;
  for (const id of selectedIds) {
    const doc = byId.get(id);
    if (!doc) {
      missingIds.push(id);
      continue;
    }
    found.push(doc);
    totalValue += doc.totalValue || 0;
  }
  return { found, missingIds, totalValue };
}

/** Snapshot selection IDs at export start so later UI changes cannot mutate the op. */
export function snapshotSelectionIds(selectedIds: ReadonlySet<string>): string[] {
  return [...selectedIds];
}
