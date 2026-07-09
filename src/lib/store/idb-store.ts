import type { Batch, BatchStore } from "@/types";

const DB_NAME = "xml-fiscal-intelligence";
const DB_VERSION = 1;
const STORE = "batches";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "batch.id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveBatchStore(store: BatchStore): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(store);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function idbGetBatchStore(batchId: string): Promise<BatchStore | null> {
  const db = await openDb();
  const result = await new Promise<BatchStore | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(batchId);
    req.onsuccess = () => resolve((req.result as BatchStore) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function idbListBatches(): Promise<Batch[]> {
  const db = await openDb();
  const stores = await new Promise<BatchStore[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
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
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(batchId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
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

/** Collect XML hashes from all local batches for incremental import. */
export async function idbCollectKnownHashes(workspaceId?: string): Promise<Set<string>> {
  const db = await openDb();
  const stores = await new Promise<BatchStore[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as BatchStore[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  const hashes = new Set<string>();
  for (const s of stores) {
    if (workspaceId && s.batch.workspaceId !== workspaceId) continue;
    for (const d of s.documents) {
      if (d.xmlHash) hashes.add(d.xmlHash);
    }
  }
  return hashes;
}
