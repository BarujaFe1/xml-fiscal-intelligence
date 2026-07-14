/**
 * Reinf events — IndexedDB local-first.
 */

import type { ReinfCanonicalEvent, ReinfBatch, ReinfEventStatus } from "@/modules/obligations/reinf/lifecycle";
import { assertTransition } from "@/modules/obligations/reinf/lifecycle";

const DB = "xfi_reinf_v1";
const EVENTS = "events";
const BATCHES = "batches";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(EVENTS)) {
        const os = db.createObjectStore(EVENTS, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
        os.createIndex("by_period", "periodKey", { unique: false });
        os.createIndex("by_status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(BATCHES)) {
        db.createObjectStore(BATCHES, { keyPath: "id" });
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

export async function saveReinfEvent(event: ReinfCanonicalEvent): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(EVENTS, "readwrite");
  tx.objectStore(EVENTS).put({ ...event, updatedAt: new Date().toISOString() });
  await txDone(tx);
}

export async function getReinfEvent(id: string): Promise<ReinfCanonicalEvent | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS, "readonly");
    const req = tx.objectStore(EVENTS).get(id);
    req.onsuccess = () => resolve((req.result as ReinfCanonicalEvent) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listReinfEvents(filter?: {
  workspaceId?: string;
  periodKey?: string;
}): Promise<ReinfCanonicalEvent[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS, "readonly");
    const req = tx.objectStore(EVENTS).getAll();
    req.onsuccess = () => {
      let rows = (req.result || []) as ReinfCanonicalEvent[];
      if (filter?.workspaceId) rows = rows.filter((r) => r.workspaceId === filter.workspaceId);
      if (filter?.periodKey) rows = rows.filter((r) => r.periodKey === filter.periodKey);
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function transitionReinfEvent(
  id: string,
  to: ReinfEventStatus,
  patch?: Partial<ReinfCanonicalEvent>,
): Promise<ReinfCanonicalEvent> {
  const ev = await getReinfEvent(id);
  if (!ev) throw new Error("evento não encontrado");
  assertTransition(ev.status, to);
  const next: ReinfCanonicalEvent = {
    ...ev,
    ...patch,
    status: to,
    updatedAt: new Date().toISOString(),
  };
  await saveReinfEvent(next);
  return next;
}

export async function saveReinfBatch(batch: ReinfBatch): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BATCHES, "readwrite");
  tx.objectStore(BATCHES).put({ ...batch, updatedAt: new Date().toISOString() });
  await txDone(tx);
}
