/**
 * Local repository for original fiscal XML payloads.
 * Stored in a dedicated IndexedDB object store — never in localStorage / never reconstructed.
 */

import { openFiscalIdb, RAW_XML_STORE } from "@/lib/store/idb-open";

export type RawXmlRecord = {
  /** Composite key: `${batchId}:${documentId}` */
  id: string;
  batchId: string;
  documentId: string;
  fileName: string;
  xmlHash: string;
  /** Exact original text extracted from the ZIP — never reconstructed. */
  content: string;
  byteLength: number;
  createdAt: string;
};

export type RawXmlMeta = Omit<RawXmlRecord, "content">;

export type RawXmlWriteInput = {
  batchId: string;
  documentId: string;
  fileName: string;
  xmlHash: string;
  content: string;
};

export class RawXmlQuotaError extends Error {
  readonly code = "quota_exceeded" as const;
  constructor(
    message = "Espaço local insuficiente para guardar os XMLs originais (quota do IndexedDB).",
  ) {
    super(message);
    this.name = "RawXmlQuotaError";
  }
}

export function rawXmlRecordId(batchId: string, documentId: string): string {
  return `${batchId}:${documentId}`;
}

export function toRawXmlRecord(input: RawXmlWriteInput): RawXmlRecord {
  const byteLength =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(input.content).byteLength
      : Buffer.byteLength(input.content, "utf8");
  return {
    id: rawXmlRecordId(input.batchId, input.documentId),
    batchId: input.batchId,
    documentId: input.documentId,
    fileName: input.fileName,
    xmlHash: input.xmlHash,
    content: input.content,
    byteLength,
    createdAt: new Date().toISOString(),
  };
}

type IdbOpener = () => Promise<IDBDatabase>;

let openerOverride: IdbOpener | null = null;

/** Test hook — inject a fake IndexedDB opener. */
export function setRawXmlDbOpenerForTests(opener: IdbOpener | null) {
  openerOverride = opener;
}

async function openRawXmlDb(): Promise<IDBDatabase> {
  if (openerOverride) return openerOverride();
  return openFiscalIdb();
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name?: string }).name) : "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

export async function idbPutRawXmls(inputs: RawXmlWriteInput[]): Promise<void> {
  if (!inputs.length) return;
  const db = await openRawXmlDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RAW_XML_STORE, "readwrite");
      const store = tx.objectStore(RAW_XML_STORE);
      for (const input of inputs) {
        store.put(toRawXmlRecord(input));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const err = tx.error;
        reject(isQuotaError(err) ? new RawXmlQuotaError() : err);
      };
      tx.onabort = () => {
        const err = tx.error;
        reject(isQuotaError(err) ? new RawXmlQuotaError() : err || new Error("rawXml write aborted"));
      };
    });
  } finally {
    db.close();
  }
}

export async function idbGetRawXml(
  batchId: string,
  documentId: string,
): Promise<RawXmlRecord | null> {
  const db = await openRawXmlDb();
  try {
    return await new Promise<RawXmlRecord | null>((resolve, reject) => {
      const tx = db.transaction(RAW_XML_STORE, "readonly");
      const req = tx.objectStore(RAW_XML_STORE).get(rawXmlRecordId(batchId, documentId));
      req.onsuccess = () => resolve((req.result as RawXmlRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function idbGetRawXmlsForDocuments(
  batchId: string,
  documentIds: string[],
): Promise<Map<string, RawXmlRecord>> {
  const out = new Map<string, RawXmlRecord>();
  if (!documentIds.length) return out;
  const db = await openRawXmlDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RAW_XML_STORE, "readonly");
      const store = tx.objectStore(RAW_XML_STORE);
      let pending = documentIds.length;
      for (const documentId of documentIds) {
        const req = store.get(rawXmlRecordId(batchId, documentId));
        req.onsuccess = () => {
          const row = req.result as RawXmlRecord | undefined;
          if (row) out.set(documentId, row);
          pending -= 1;
          if (pending === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      }
    });
  } finally {
    db.close();
  }
  return out;
}

export async function idbListRawXmlMetaForBatch(batchId: string): Promise<RawXmlMeta[]> {
  const db = await openRawXmlDb();
  try {
    const rows = await new Promise<RawXmlRecord[]>((resolve, reject) => {
      const tx = db.transaction(RAW_XML_STORE, "readonly");
      const index = tx.objectStore(RAW_XML_STORE).index("batchId");
      const req = index.getAll(batchId);
      req.onsuccess = () => resolve((req.result as RawXmlRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
    return rows.map(({ content, ...meta }) => {
      void content;
      return meta;
    });
  } finally {
    db.close();
  }
}

export async function idbHasRawXmlAvailability(
  batchId: string,
  documentIds: string[],
): Promise<Map<string, boolean>> {
  const meta = await idbListRawXmlMetaForBatch(batchId);
  const available = new Set(meta.map((m) => m.documentId));
  const map = new Map<string, boolean>();
  for (const id of documentIds) map.set(id, available.has(id));
  return map;
}

export async function idbCountRawXmlsForBatch(batchId: string): Promise<number> {
  const db = await openRawXmlDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(RAW_XML_STORE, "readonly");
      const index = tx.objectStore(RAW_XML_STORE).index("batchId");
      const req = index.count(batchId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function idbDeleteRawXmlsForBatch(batchId: string): Promise<number> {
  const db = await openRawXmlDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(RAW_XML_STORE, "readwrite");
      const store = tx.objectStore(RAW_XML_STORE);
      const index = store.index("batchId");
      const req = index.openCursor(IDBKeyRange.only(batchId));
      let deleted = 0;
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        cursor.delete();
        deleted += 1;
        cursor.continue();
      };
      tx.oncomplete = () => resolve(deleted);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
