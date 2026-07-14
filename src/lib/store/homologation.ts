/**
 * Homologation scenarios IndexedDB.
 */

import type { ValidatedScenario } from "@/modules/homologation/types";

const DB = "xfi_homologation_v1";
const SCN = "scenarios";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SCN)) {
        const os = db.createObjectStore(SCN, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
        os.createIndex("by_obligation", "obligationId", { unique: false });
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

export async function saveScenario(scn: ValidatedScenario): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SCN, "readwrite");
  tx.objectStore(SCN).put({ ...scn, updatedAt: new Date().toISOString() });
  await txDone(tx);
}

export async function listScenarios(workspaceId: string): Promise<ValidatedScenario[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCN, "readonly");
    const req = tx.objectStore(SCN).getAll();
    req.onsuccess = () => {
      const rows = ((req.result || []) as ValidatedScenario[]).filter(
        (s) => s.workspaceId === workspaceId,
      );
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}
