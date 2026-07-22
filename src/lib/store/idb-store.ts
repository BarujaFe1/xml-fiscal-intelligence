import type { Batch, BatchStore } from "@/types";
import { BATCH_OBJECT_STORE, openFiscalIdb } from "@/lib/store/idb-open";
import { idbDeleteRawXmlsForBatch } from "@/lib/store/raw-xml-store";

export {
  FISCAL_IDB_NAME,
  FISCAL_IDB_VERSION,
  BATCH_OBJECT_STORE,
  RAW_XML_STORE,
  openFiscalIdb,
} from "@/lib/store/idb-open";

function openDb(): Promise<IDBDatabase> {
  return openFiscalIdb();
}

export async function idbSaveBatchStore(store: BatchStore): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BATCH_OBJECT_STORE, "readwrite");
    tx.objectStore(BATCH_OBJECT_STORE).put(store);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function idbGetBatchStore(batchId: string): Promise<BatchStore | null> {
  const db = await openDb();
  const result = await new Promise<BatchStore | null>((resolve, reject) => {
    const tx = db.transaction(BATCH_OBJECT_STORE, "readonly");
    const req = tx.objectStore(BATCH_OBJECT_STORE).get(batchId);
    req.onsuccess = () => resolve((req.result as BatchStore) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function idbListBatches(): Promise<Batch[]> {
  const db = await openDb();
  const stores = await new Promise<BatchStore[]>((resolve, reject) => {
    const tx = db.transaction(BATCH_OBJECT_STORE, "readonly");
    const req = tx.objectStore(BATCH_OBJECT_STORE).getAll();
    req.onsuccess = () => resolve((req.result as BatchStore[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return stores
    .map((s) => s.batch)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function idbDeleteBatch(batchId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BATCH_OBJECT_STORE, "readwrite");
    tx.objectStore(BATCH_OBJECT_STORE).delete(batchId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  // Cascade: remove associated original XMLs (best-effort; empty for pre-v2 batches).
  try {
    await idbDeleteRawXmlsForBatch(batchId);
  } catch {
    // non-fatal — batch metadata already removed
  }
}

/** Merge API batches with IndexedDB (IDB wins on id collision). */
export async function mergeBatchLists(apiBatches: Batch[]): Promise<Batch[]> {
  const local = await idbListBatches();
  const map = new Map<string, Batch>();
  for (const b of apiBatches) map.set(b.id, b);
  for (const b of local) map.set(b.id, b);
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export type KnownHashEntry = { documentId: string; batchId: string };

/** Map xmlHash → first local canonical document for incremental lineage. */
export async function idbCollectKnownHashIndex(
  workspaceId?: string,
): Promise<Map<string, KnownHashEntry>> {
  const db = await openDb();
  const stores = await new Promise<BatchStore[]>((resolve, reject) => {
    const tx = db.transaction(BATCH_OBJECT_STORE, "readonly");
    const req = tx.objectStore(BATCH_OBJECT_STORE).getAll();
    req.onsuccess = () => resolve((req.result as BatchStore[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  const index = new Map<string, KnownHashEntry>();
  for (const s of stores) {
    if (workspaceId && s.batch.workspaceId !== workspaceId) continue;
    for (const d of s.documents) {
      if (!d.xmlHash || index.has(d.xmlHash)) continue;
      index.set(d.xmlHash, { documentId: d.id, batchId: s.batch.id });
    }
  }
  return index;
}

/** Collect XML hashes from all local batches for incremental import. */
export async function idbCollectKnownHashes(workspaceId?: string): Promise<Set<string>> {
  return new Set((await idbCollectKnownHashIndex(workspaceId)).keys());
}
