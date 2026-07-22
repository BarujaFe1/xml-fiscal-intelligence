export const FISCAL_IDB_NAME = "xml-fiscal-intelligence";
/** v1: batches only. v2: adds dedicated `rawXml` object store for original XML payloads. */
export const FISCAL_IDB_VERSION = 2;
export const BATCH_OBJECT_STORE = "batches";
export const RAW_XML_STORE = "rawXml";

function upgradeFiscalIdb(db: IDBDatabase, oldVersion: number) {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(BATCH_OBJECT_STORE)) {
      db.createObjectStore(BATCH_OBJECT_STORE, { keyPath: "batch.id" });
    }
  }
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains(RAW_XML_STORE)) {
      const raw = db.createObjectStore(RAW_XML_STORE, { keyPath: "id" });
      raw.createIndex("batchId", "batchId", { unique: false });
      raw.createIndex("documentId", "documentId", { unique: false });
      raw.createIndex("xmlHash", "xmlHash", { unique: false });
    }
  }
}

/** Shared IndexedDB opener (batches + rawXml). Safe for browser-only callers. */
export function openFiscalIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FISCAL_IDB_NAME, FISCAL_IDB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion || 0;
      upgradeFiscalIdb(db, oldVersion);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
