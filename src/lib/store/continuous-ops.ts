/**
 * Continuous-ops IndexedDB — NT inbox + quotas.
 */

import type { NtInboxItem, QuotaPolicy, QuotaUsage } from "@/modules/continuous-ops/types";

const DB = "xfi_continuous_ops_v1";
const NT = "nt_inbox";
const QUOTA = "quotas";
const USAGE = "usage";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(NT)) {
        const os = db.createObjectStore(NT, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(QUOTA)) {
        db.createObjectStore(QUOTA, { keyPath: "workspaceId" });
      }
      if (!db.objectStoreNames.contains(USAGE)) {
        db.createObjectStore(USAGE, { keyPath: "workspaceId" });
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

export async function saveNtItem(item: NtInboxItem): Promise<void> {
  if (item.ruleSetActivated) throw new Error("NT inbox não persiste ruleSetActivated=true");
  const db = await openDb();
  const tx = db.transaction(NT, "readwrite");
  tx.objectStore(NT).put(item);
  await txDone(tx);
}

export async function listNtItems(workspaceId: string): Promise<NtInboxItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NT, "readonly");
    const req = tx.objectStore(NT).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as NtInboxItem[]).filter((i) => i.workspaceId === workspaceId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveQuotaPolicy(policy: QuotaPolicy): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(QUOTA, "readwrite");
  tx.objectStore(QUOTA).put(policy);
  await txDone(tx);
}

export async function getQuotaPolicy(workspaceId: string): Promise<QuotaPolicy | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUOTA, "readonly");
    const req = tx.objectStore(QUOTA).get(workspaceId);
    req.onsuccess = () => resolve((req.result as QuotaPolicy) || null);
    req.onerror = () => reject(req.error);
  });
}

export type StoredUsage = QuotaUsage & { workspaceId: string };

export async function saveUsage(row: StoredUsage): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(USAGE, "readwrite");
  tx.objectStore(USAGE).put(row);
  await txDone(tx);
}

export async function getUsage(workspaceId: string): Promise<StoredUsage | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USAGE, "readonly");
    const req = tx.objectStore(USAGE).get(workspaceId);
    req.onsuccess = () => resolve((req.result as StoredUsage) || null);
    req.onerror = () => reject(req.error);
  });
}
