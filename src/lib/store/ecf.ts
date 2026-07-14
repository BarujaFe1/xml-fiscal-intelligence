/**
 * ECF workspace IndexedDB — maps, referentials, e-Lalur, prior.
 */

import type {
  AccountReferentialMap,
  ElalurSnapshot,
  EcfPriorCanonical,
  ReferentialTableVersion,
} from "@/modules/ecf/types";
import { hashElalur } from "@/modules/ecf/elalur/model";

const DB = "xfi_ecf_v1";
const MAPS = "maps";
const REFS = "referentials";
const ELALUR = "elalur";
const PRIOR = "prior";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MAPS)) {
        const os = db.createObjectStore(MAPS, { keyPath: "id" });
        os.createIndex("by_company", "companyId", { unique: false });
      }
      if (!db.objectStoreNames.contains(REFS)) {
        const os = db.createObjectStore(REFS, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(ELALUR)) {
        const os = db.createObjectStore(ELALUR, { keyPath: "id" });
        os.createIndex("by_company_period", ["companyId", "periodKey"], { unique: false });
      }
      if (!db.objectStoreNames.contains(PRIOR)) {
        db.createObjectStore(PRIOR, { keyPath: "id" });
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

export async function saveAccountMap(map: AccountReferentialMap): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MAPS, "readwrite");
  tx.objectStore(MAPS).put({ ...map, updatedAt: new Date().toISOString() });
  await txDone(tx);
}

export async function listAccountMaps(companyId: string): Promise<AccountReferentialMap[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MAPS, "readonly");
    const req = tx.objectStore(MAPS).getAll();
    req.onsuccess = () => {
      const rows = ((req.result || []) as AccountReferentialMap[]).filter(
        (m) => m.companyId === companyId,
      );
      rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveReferentialTable(table: ReferentialTableVersion): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(REFS, "readwrite");
  tx.objectStore(REFS).put(table);
  await txDone(tx);
}

export async function listReferentialTables(workspaceId: string): Promise<ReferentialTableVersion[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REFS, "readonly");
    const req = tx.objectStore(REFS).getAll();
    req.onsuccess = () => {
      const rows = ((req.result || []) as ReferentialTableVersion[]).filter(
        (t) => t.workspaceId === workspaceId,
      );
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveElalur(snap: ElalurSnapshot): Promise<ElalurSnapshot> {
  if (snap.locked) throw new Error("e-Lalur bloqueado — versão imutável");
  const contentHash = await hashElalur(snap);
  const next = { ...snap, contentHash, updatedAt: new Date().toISOString() };
  const db = await openDb();
  const tx = db.transaction(ELALUR, "readwrite");
  tx.objectStore(ELALUR).put(next);
  await txDone(tx);
  return next;
}

export async function listElalur(
  companyId: string,
  periodKey?: string,
): Promise<ElalurSnapshot[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ELALUR, "readonly");
    const req = tx.objectStore(ELALUR).getAll();
    req.onsuccess = () => {
      let rows = ((req.result || []) as ElalurSnapshot[]).filter((e) => e.companyId === companyId);
      if (periodKey) rows = rows.filter((e) => e.periodKey === periodKey);
      rows.sort((a, b) => b.version - a.version);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function lockElalur(id: string): Promise<ElalurSnapshot> {
  const db = await openDb();
  const current = await new Promise<ElalurSnapshot | null>((resolve, reject) => {
    const tx = db.transaction(ELALUR, "readonly");
    const req = tx.objectStore(ELALUR).get(id);
    req.onsuccess = () => resolve((req.result as ElalurSnapshot) || null);
    req.onerror = () => reject(req.error);
  });
  if (!current) throw new Error("e-Lalur não encontrado");
  const next = { ...current, locked: true, updatedAt: new Date().toISOString() };
  const tx = db.transaction(ELALUR, "readwrite");
  tx.objectStore(ELALUR).put(next);
  await txDone(tx);
  return next;
}

export type StoredEcfPrior = {
  id: string;
  workspaceId: string;
  companyId: string;
  periodKey: string;
  prior: EcfPriorCanonical;
  importedAt: string;
};

export async function savePriorEcf(row: StoredEcfPrior): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PRIOR, "readwrite");
  tx.objectStore(PRIOR).put(row);
  await txDone(tx);
}

export async function getPriorEcf(id: string): Promise<StoredEcfPrior | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRIOR, "readonly");
    const req = tx.objectStore(PRIOR).get(id);
    req.onsuccess = () => resolve((req.result as StoredEcfPrior) || null);
    req.onerror = () => reject(req.error);
  });
}
