/**
 * Ops platform IndexedDB — tasks, generations, evidence, prefs, regulatory.
 */

import type {
  ClosingTask,
  EvidenceMeta,
  ImmutableGeneration,
  NotificationPayload,
  NotificationPrefs,
  RegulatoryCatalogItem,
  SodPolicy,
} from "@/modules/ops/types";

const DB = "xfi_ops_v1";
const TASKS = "tasks";
const GENS = "generations";
const EVIDENCE = "evidence";
const PREFS = "prefs";
const NOTIFS = "notifications";
const REG = "regulatory";
const SOD = "sod";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TASKS)) {
        const os = db.createObjectStore(TASKS, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(GENS)) {
        const os = db.createObjectStore(GENS, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(EVIDENCE)) {
        const os = db.createObjectStore(EVIDENCE, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(PREFS)) {
        db.createObjectStore(PREFS, { keyPath: "workspaceId" });
      }
      if (!db.objectStoreNames.contains(NOTIFS)) {
        const os = db.createObjectStore(NOTIFS, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(REG)) {
        db.createObjectStore(REG, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SOD)) {
        db.createObjectStore(SOD, { keyPath: "workspaceId" });
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

export async function saveTask(task: ClosingTask): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(TASKS, "readwrite");
  tx.objectStore(TASKS).put(task);
  await txDone(tx);
}

export async function listTasks(workspaceId: string): Promise<ClosingTask[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TASKS, "readonly");
    const req = tx.objectStore(TASKS).getAll();
    req.onsuccess = () => {
      const rows = ((req.result || []) as ClosingTask[]).filter(
        (t) => t.workspaceId === workspaceId,
      );
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveGeneration(gen: ImmutableGeneration): Promise<void> {
  if (!gen.locked) throw new Error("geração deve nascer locked");
  const db = await openDb();
  const tx = db.transaction(GENS, "readwrite");
  tx.objectStore(GENS).put(gen);
  await txDone(tx);
}

export async function listGenerations(workspaceId: string): Promise<ImmutableGeneration[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GENS, "readonly");
    const req = tx.objectStore(GENS).getAll();
    req.onsuccess = () => {
      const rows = ((req.result || []) as ImmutableGeneration[]).filter(
        (g) => g.workspaceId === workspaceId,
      );
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveEvidence(ev: EvidenceMeta): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(EVIDENCE, "readwrite");
  tx.objectStore(EVIDENCE).put(ev);
  await txDone(tx);
}

export async function listEvidence(workspaceId: string): Promise<EvidenceMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVIDENCE, "readonly");
    const req = tx.objectStore(EVIDENCE).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as EvidenceMeta[]).filter((e) => e.workspaceId === workspaceId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function savePrefs(prefs: NotificationPrefs): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PREFS, "readwrite");
  tx.objectStore(PREFS).put(prefs);
  await txDone(tx);
}

export async function getPrefs(workspaceId: string): Promise<NotificationPrefs | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PREFS, "readonly");
    const req = tx.objectStore(PREFS).get(workspaceId);
    req.onsuccess = () => resolve((req.result as NotificationPrefs) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveNotification(n: NotificationPayload): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(NOTIFS, "readwrite");
  tx.objectStore(NOTIFS).put(n);
  await txDone(tx);
}

export async function listNotifications(workspaceId: string): Promise<NotificationPayload[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTIFS, "readonly");
    const req = tx.objectStore(NOTIFS).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as NotificationPayload[]).filter((n) => n.workspaceId === workspaceId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveRegulatory(item: RegulatoryCatalogItem): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(REG, "readwrite");
  tx.objectStore(REG).put(item);
  await txDone(tx);
}

export async function listRegulatory(): Promise<RegulatoryCatalogItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REG, "readonly");
    const req = tx.objectStore(REG).getAll();
    req.onsuccess = () => resolve((req.result || []) as RegulatoryCatalogItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSodPolicy(policy: SodPolicy): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SOD, "readwrite");
  tx.objectStore(SOD).put(policy);
  await txDone(tx);
}

export async function getSodPolicy(workspaceId: string): Promise<SodPolicy | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOD, "readonly");
    const req = tx.objectStore(SOD).get(workspaceId);
    req.onsuccess = () => resolve((req.result as SodPolicy) || null);
    req.onerror = () => reject(req.error);
  });
}
