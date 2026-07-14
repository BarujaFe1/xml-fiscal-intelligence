/**
 * Enterprise IndexedDB — marketplace listings + legal status.
 */

import type { LegalCommercialStatus, MarketplaceListing } from "@/modules/enterprise/types";

const DB = "xfi_enterprise_v1";
const LISTINGS = "marketplace_listings";
const LEGAL = "legal_status";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LISTINGS)) {
        const os = db.createObjectStore(LISTINGS, { keyPath: "id" });
        os.createIndex("by_tenant", "tenantId", { unique: false });
      }
      if (!db.objectStoreNames.contains(LEGAL)) {
        db.createObjectStore(LEGAL, { keyPath: "tenantId" });
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

export async function saveListing(listing: MarketplaceListing): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(LISTINGS, "readwrite");
  tx.objectStore(LISTINGS).put(listing);
  await txDone(tx);
}

export async function listListings(tenantId: string): Promise<MarketplaceListing[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LISTINGS, "readonly");
    const req = tx.objectStore(LISTINGS).getAll();
    req.onsuccess = () => {
      resolve(
        ((req.result || []) as MarketplaceListing[]).filter((l) => l.tenantId === tenantId),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export type StoredLegal = LegalCommercialStatus & { tenantId: string };

export async function saveLegalStatus(row: StoredLegal): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(LEGAL, "readwrite");
  tx.objectStore(LEGAL).put(row);
  await txDone(tx);
}

export async function getLegalStatus(tenantId: string): Promise<StoredLegal | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEGAL, "readonly");
    const req = tx.objectStore(LEGAL).get(tenantId);
    req.onsuccess = () => resolve((req.result as StoredLegal) || null);
    req.onerror = () => reject(req.error);
  });
}
