/**
 * Governance IndexedDB — roles, retention, campaigns.
 */

import type {
  RetentionPolicy,
  ValidatedScopeCampaign,
  WorkspaceRoleBinding,
} from "@/modules/governance/types";

const DB = "xfi_governance_v1";
const ROLES = "role_bindings";
const RETENTION = "retention";
const CAMPAIGNS = "campaigns";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROLES)) {
        const os = db.createObjectStore(ROLES, { keyPath: ["workspaceId", "userId", "role"] });
        os.createIndex("by_workspace", "workspaceId", { unique: false });
      }
      if (!db.objectStoreNames.contains(RETENTION)) {
        db.createObjectStore(RETENTION, { keyPath: "id" }).createIndex(
          "by_workspace",
          "workspaceId",
          { unique: false },
        );
      }
      if (!db.objectStoreNames.contains(CAMPAIGNS)) {
        db.createObjectStore(CAMPAIGNS, { keyPath: "id" }).createIndex(
          "by_workspace",
          "workspaceId",
          { unique: false },
        );
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

export async function saveRoleBinding(b: WorkspaceRoleBinding): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ROLES, "readwrite");
  tx.objectStore(ROLES).put(b);
  await txDone(tx);
}

export async function listRoleBindings(workspaceId: string): Promise<WorkspaceRoleBinding[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ROLES, "readonly");
    const req = tx.objectStore(ROLES).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as WorkspaceRoleBinding[]).filter(
          (r) => r.workspaceId === workspaceId,
        ),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveRetentionPolicy(p: RetentionPolicy): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(RETENTION, "readwrite");
  tx.objectStore(RETENTION).put(p);
  await txDone(tx);
}

export async function listRetentionPolicies(workspaceId: string): Promise<RetentionPolicy[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RETENTION, "readonly");
    const req = tx.objectStore(RETENTION).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as RetentionPolicy[]).filter((r) => r.workspaceId === workspaceId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveCampaign(c: ValidatedScopeCampaign): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CAMPAIGNS, "readwrite");
  tx.objectStore(CAMPAIGNS).put(c);
  await txDone(tx);
}

export async function listCampaigns(workspaceId: string): Promise<ValidatedScopeCampaign[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CAMPAIGNS, "readonly");
    const req = tx.objectStore(CAMPAIGNS).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as ValidatedScopeCampaign[]).filter(
          (r) => r.workspaceId === workspaceId,
        ),
      );
    };
    req.onerror = () => reject(req.error);
  });
}
