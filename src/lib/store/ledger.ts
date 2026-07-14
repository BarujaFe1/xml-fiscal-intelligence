/**
 * Ledger IndexedDB — local-first accounting store.
 */

import type { ChartAccount, JournalEntry, LedgerSnapshot } from "@/modules/accounting/types";
import { assertEntryMutable, hashEntry, validateEntry } from "@/modules/accounting/rules";

const DB = "xfi_ledger_v1";
const ACC = "accounts";
const ENT = "entries";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ACC)) {
        const os = db.createObjectStore(ACC, { keyPath: "id" });
        os.createIndex("by_company", "companyId", { unique: false });
        os.createIndex("by_code", "code", { unique: false });
      }
      if (!db.objectStoreNames.contains(ENT)) {
        const os = db.createObjectStore(ENT, { keyPath: "id" });
        os.createIndex("by_company", "companyId", { unique: false });
        os.createIndex("by_date", "entryDate", { unique: false });
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

export async function saveAccount(account: ChartAccount): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ACC, "readwrite");
  tx.objectStore(ACC).put({ ...account, updatedAt: new Date().toISOString() });
  await txDone(tx);
}

export async function listAccounts(companyId: string): Promise<ChartAccount[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ACC, "readonly");
    const req = tx.objectStore(ACC).getAll();
    req.onsuccess = () => {
      const rows = ((req.result || []) as ChartAccount[]).filter((a) => a.companyId === companyId);
      rows.sort((a, b) => a.code.localeCompare(b.code));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveEntry(entry: JournalEntry, accounts: ChartAccount[]): Promise<JournalEntry> {
  if (entry.status !== "draft") {
    // allow create as posted after validation
  } else {
    assertEntryMutable(entry);
  }
  if (entry.status === "locked") throw new Error("não grava locked via saveEntry genérico");
  const issues = validateEntry(entry, accounts);
  if (issues.some((i) => i.severity === "error") && entry.status !== "draft") {
    throw new Error(issues.filter((i) => i.severity === "error").map((i) => i.message).join("; "));
  }
  const contentHash = await hashEntry(entry);
  const next = { ...entry, contentHash, updatedAt: new Date().toISOString() };
  const db = await openDb();
  const tx = db.transaction(ENT, "readwrite");
  tx.objectStore(ENT).put(next);
  await txDone(tx);
  return next;
}

export async function listEntries(companyId: string): Promise<JournalEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENT, "readonly");
    const req = tx.objectStore(ENT).getAll();
    req.onsuccess = () => {
      const rows = ((req.result || []) as JournalEntry[]).filter((e) => e.companyId === companyId);
      rows.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getEntry(id: string): Promise<JournalEntry | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ENT, "readonly");
    const req = tx.objectStore(ENT).get(id);
    req.onsuccess = () => resolve((req.result as JournalEntry) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function loadLedgerSnapshot(companyId: string): Promise<LedgerSnapshot> {
  const [accounts, entries] = await Promise.all([listAccounts(companyId), listEntries(companyId)]);
  return { accounts, entries };
}

export async function lockEntry(id: string): Promise<JournalEntry> {
  const entry = await getEntry(id);
  if (!entry) throw new Error("lançamento não encontrado");
  if (entry.status !== "approved") throw new Error("só lock após approved");
  const accounts = await listAccounts(entry.companyId);
  const issues = validateEntry(entry, accounts);
  if (issues.some((i) => i.severity === "error")) {
    throw new Error("não trava lançamento com erros");
  }
  const next: JournalEntry = {
    ...entry,
    status: "locked",
    contentHash: await hashEntry(entry),
    updatedAt: new Date().toISOString(),
  };
  const db = await openDb();
  const tx = db.transaction(ENT, "readwrite");
  tx.objectStore(ENT).put(next);
  await txDone(tx);
  return next;
}
