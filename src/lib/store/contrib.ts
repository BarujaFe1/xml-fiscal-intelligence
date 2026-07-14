/**
 * EFD-Contribuições domain IndexedDB — local-first.
 */

import type { ContribEntry, RateioLine } from "@/modules/contrib/types";

const DB = "xfi_contrib_v1";
const ENTRIES = "entries";
const RATEIO = "rateio";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ENTRIES)) {
        const os = db.createObjectStore(ENTRIES, { keyPath: "id" });
        os.createIndex("by_company", "companyId", { unique: false });
        os.createIndex("by_period", "periodKey", { unique: false });
      }
      if (!db.objectStoreNames.contains(RATEIO)) {
        const os = db.createObjectStore(RATEIO, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveContribEntry(entry: ContribEntry): Promise<void> {
  if (entry.kind === "credit" && !entry.creditExplicit) {
    throw new Error("crédito exige creditExplicit=true — não inventar a partir de XML");
  }
  const db = await openDb();
  const tx = db.transaction(ENTRIES, "readwrite");
  tx.objectStore(ENTRIES).put({ ...entry, updatedAt: new Date().toISOString() });
  await txDone(tx);
}

export async function listContribEntries(filter: {
  companyId: string;
  periodKey?: string;
}): Promise<ContribEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENTRIES, "readonly");
    const req = tx.objectStore(ENTRIES).getAll();
    req.onsuccess = () => {
      let rows = ((req.result || []) as ContribEntry[]).filter(
        (e) => e.companyId === filter.companyId,
      );
      if (filter.periodKey) rows = rows.filter((e) => e.periodKey === filter.periodKey);
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export type StoredRateio = RateioLine & { id: string; workspaceId: string; companyId: string };

export async function saveRateioLine(row: StoredRateio): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(RATEIO, "readwrite");
  tx.objectStore(RATEIO).put(row);
  await txDone(tx);
}

export async function listRateioLines(companyId: string): Promise<StoredRateio[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RATEIO, "readonly");
    const req = tx.objectStore(RATEIO).getAll();
    req.onsuccess = () => {
      const rows = ((req.result || []) as StoredRateio[]).filter((r) => r.companyId === companyId);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}
