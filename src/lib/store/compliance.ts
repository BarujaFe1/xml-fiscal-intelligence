/**
 * Compliance IndexedDB — privacy requests + locale pref.
 */

import type { LocaleCode, PrivacyRequest } from "@/modules/compliance/types";

const DB = "xfi_compliance_v1";
const PRIVACY = "privacy_requests";
const PREFS = "prefs";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PRIVACY)) {
        db.createObjectStore(PRIVACY, { keyPath: "id" }).createIndex(
          "by_workspace",
          "workspaceId",
          { unique: false },
        );
      }
      if (!db.objectStoreNames.contains(PREFS)) {
        db.createObjectStore(PREFS, { keyPath: "workspaceId" });
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

export async function savePrivacyRequest(r: PrivacyRequest): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PRIVACY, "readwrite");
  tx.objectStore(PRIVACY).put(r);
  await txDone(tx);
}

export async function listPrivacyRequests(workspaceId: string): Promise<PrivacyRequest[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRIVACY, "readonly");
    const req = tx.objectStore(PRIVACY).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as PrivacyRequest[]).filter((r) => r.workspaceId === workspaceId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export type CompliancePrefs = { workspaceId: string; locale: LocaleCode; updatedAt: string };

export async function saveCompliancePrefs(p: CompliancePrefs): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PREFS, "readwrite");
  tx.objectStore(PREFS).put(p);
  await txDone(tx);
}

export async function getCompliancePrefs(workspaceId: string): Promise<CompliancePrefs | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREFS, "readonly");
    const req = tx.objectStore(PREFS).get(workspaceId);
    req.onsuccess = () => resolve((req.result as CompliancePrefs) || null);
    req.onerror = () => reject(req.error);
  });
}
