/**
 * Scale IndexedDB — drills, meter samples, mass campaigns, pen-test findings.
 */

import type {
  DrDrillRecord,
  MassCampaign,
  MeterSample,
  PenTestFinding,
} from "@/modules/scale/types";
import type { EnterprisePlanId } from "@/modules/scale/types";

const DB = "xfi_scale_v1";
const DRILLS = "dr_drills";
const METERS = "meter_samples";
const CAMPAIGNS = "mass_campaigns";
const FINDINGS = "pen_findings";
const PLANS = "workspace_plans";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRILLS)) {
        db.createObjectStore(DRILLS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(METERS)) {
        const os = db.createObjectStore(METERS, { keyPath: "id" });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(CAMPAIGNS)) {
        db.createObjectStore(CAMPAIGNS, { keyPath: "id" }).createIndex(
          "by_workspace",
          "workspaceId",
          { unique: false },
        );
      }
      if (!db.objectStoreNames.contains(FINDINGS)) {
        db.createObjectStore(FINDINGS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PLANS)) {
        db.createObjectStore(PLANS, { keyPath: "workspaceId" });
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

export async function saveDrill(d: DrDrillRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(DRILLS, "readwrite");
  tx.objectStore(DRILLS).put(d);
  await txDone(tx);
}

export async function listDrills(): Promise<DrDrillRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRILLS, "readonly");
    const req = tx.objectStore(DRILLS).getAll();
    req.onsuccess = () => resolve((req.result || []) as DrDrillRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export type StoredMeter = MeterSample & { id: string };

export async function saveMeterSample(s: MeterSample): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(METERS, "readwrite");
  const row: StoredMeter = { ...s, id: `m_${s.workspaceId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}` };
  tx.objectStore(METERS).put(row);
  await txDone(tx);
}

export async function listMeterSamples(workspaceId: string): Promise<MeterSample[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(METERS, "readonly");
    const req = tx.objectStore(METERS).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as StoredMeter[])
          .filter((r) => r.workspaceId === workspaceId)
          .map(({ id: _id, ...rest }) => rest),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveMassCampaign(c: MassCampaign): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CAMPAIGNS, "readwrite");
  tx.objectStore(CAMPAIGNS).put(c);
  await txDone(tx);
}

export async function listMassCampaigns(workspaceId: string): Promise<MassCampaign[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CAMPAIGNS, "readonly");
    const req = tx.objectStore(CAMPAIGNS).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as MassCampaign[]).filter((c) => c.workspaceId === workspaceId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveFinding(f: PenTestFinding): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(FINDINGS, "readwrite");
  tx.objectStore(FINDINGS).put(f);
  await txDone(tx);
}

export async function listFindings(): Promise<PenTestFinding[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FINDINGS, "readonly");
    const req = tx.objectStore(FINDINGS).getAll();
    req.onsuccess = () => resolve((req.result || []) as PenTestFinding[]);
    req.onerror = () => reject(req.error);
  });
}

export type WorkspacePlanRow = { workspaceId: string; planId: EnterprisePlanId; updatedAt: string };

export async function saveWorkspacePlan(row: WorkspacePlanRow): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PLANS, "readwrite");
  tx.objectStore(PLANS).put(row);
  await txDone(tx);
}

export async function getWorkspacePlan(workspaceId: string): Promise<WorkspacePlanRow | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLANS, "readonly");
    const req = tx.objectStore(PLANS).get(workspaceId);
    req.onsuccess = () => resolve((req.result as WorkspacePlanRow) || null);
    req.onerror = () => reject(req.error);
  });
}
