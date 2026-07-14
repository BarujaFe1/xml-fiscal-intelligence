/**
 * Ecosystem IndexedDB — SLO samples, partner invites/links.
 */

import type { PartnerInvite, PartnerWorkspaceLink, SloSample } from "@/modules/ecosystem/types";

const DB = "xfi_ecosystem_v1";
const SLO = "slo_samples";
const INVITES = "partner_invites";
const LINKS = "partner_links";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SLO)) {
        db.createObjectStore(SLO, { keyPath: "id" }).createIndex("by_slo", "sloId", {
          unique: false,
        });
      }
      if (!db.objectStoreNames.contains(INVITES)) {
        db.createObjectStore(INVITES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(LINKS)) {
        db.createObjectStore(LINKS, { keyPath: "id" });
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

export async function saveSloSample(s: SloSample): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SLO, "readwrite");
  tx.objectStore(SLO).put(s);
  await txDone(tx);
}

export async function listSloSamples(): Promise<SloSample[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SLO, "readonly");
    const req = tx.objectStore(SLO).getAll();
    req.onsuccess = () => resolve((req.result || []) as SloSample[]);
    req.onerror = () => reject(req.error);
  });
}

export async function savePartnerInvite(i: PartnerInvite): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(INVITES, "readwrite");
  tx.objectStore(INVITES).put(i);
  await txDone(tx);
}

export async function listPartnerInvites(tenantId: string): Promise<PartnerInvite[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INVITES, "readonly");
    const req = tx.objectStore(INVITES).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as PartnerInvite[]).filter((i) => i.tenantId === tenantId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function savePartnerLink(l: PartnerWorkspaceLink): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(LINKS, "readwrite");
  tx.objectStore(LINKS).put(l);
  await txDone(tx);
}

export async function listPartnerLinks(tenantId: string): Promise<PartnerWorkspaceLink[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LINKS, "readonly");
    const req = tx.objectStore(LINKS).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as PartnerWorkspaceLink[]).filter((l) => l.tenantId === tenantId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}
