/**
 * Local cadastro store (IndexedDB) until SaaS Postgres is wired.
 */

const DB = "xfi_cadastro_v1";
const CO = "companies";
const EST = "establishments";

export type LocalCompany = {
  id: string;
  name: string;
  cnpj?: string;
  createdAt: string;
};

export type LocalEstablishment = {
  id: string;
  companyId: string;
  name: string;
  ie?: string;
  uf: string;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CO)) db.createObjectStore(CO, { keyPath: "id" });
      if (!db.objectStoreNames.contains(EST)) db.createObjectStore(EST, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function put(store: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function listCompanies() {
  return getAll<LocalCompany>(CO);
}

export function saveCompany(c: LocalCompany) {
  return put(CO, c);
}

export function listEstablishments() {
  return getAll<LocalEstablishment>(EST);
}

export function saveEstablishment(e: LocalEstablishment) {
  return put(EST, e);
}
