/**
 * RTC IndexedDB — local-first facts store.
 */

import type { RtcFact } from "@/modules/rtc/types";

const DB = "xfi_rtc_v1";
const FACTS = "facts";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FACTS)) {
        const os = db.createObjectStore(FACTS, { keyPath: "id" });
        os.createIndex("by_company", "companyId", { unique: false });
        os.createIndex("by_period", "periodKey", { unique: false });
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

export async function saveRtcFact(fact: RtcFact): Promise<void> {
  if (fact.rateExplicit && !fact.sourceId) {
    throw new Error("alíquota exige sourceId — não inventar");
  }
  const db = await openDb();
  const tx = db.transaction(FACTS, "readwrite");
  tx.objectStore(FACTS).put({ ...fact, updatedAt: new Date().toISOString() });
  await txDone(tx);
}

export async function listRtcFacts(filter: {
  companyId: string;
  periodKey?: string;
}): Promise<RtcFact[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FACTS, "readonly");
    const req = tx.objectStore(FACTS).getAll();
    req.onsuccess = () => {
      let rows = ((req.result || []) as RtcFact[]).filter(
        (f) => f.companyId === filter.companyId,
      );
      if (filter.periodKey) rows = rows.filter((f) => f.periodKey === filter.periodKey);
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}
