/**
 * Growth IndexedDB — public listings + rate limits.
 */

import type { MarketplaceRateLimit, PublicMarketplaceListing } from "@/modules/growth/types";

const DB = "xfi_growth_v1";
const PUBLIC = "public_listings";
const RATES = "mkt_rates";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PUBLIC)) {
        db.createObjectStore(PUBLIC, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(RATES)) {
        db.createObjectStore(RATES, { keyPath: "tenantId" });
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

export async function savePublicListing(l: PublicMarketplaceListing): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PUBLIC, "readwrite");
  tx.objectStore(PUBLIC).put(l);
  await txDone(tx);
}

export async function listPublicListings(): Promise<PublicMarketplaceListing[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PUBLIC, "readonly");
    const req = tx.objectStore(PUBLIC).getAll();
    req.onsuccess = () => resolve((req.result || []) as PublicMarketplaceListing[]);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMarketplaceRate(r: MarketplaceRateLimit): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(RATES, "readwrite");
  tx.objectStore(RATES).put(r);
  await txDone(tx);
}

export async function getMarketplaceRate(tenantId: string): Promise<MarketplaceRateLimit | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RATES, "readonly");
    const req = tx.objectStore(RATES).get(tenantId);
    req.onsuccess = () => resolve((req.result as MarketplaceRateLimit) || null);
    req.onerror = () => reject(req.error);
  });
}
