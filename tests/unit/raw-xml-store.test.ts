import { afterEach, describe, expect, it } from "vitest";
import {
  idbDeleteRawXmlsForBatch,
  idbGetRawXml,
  idbPutRawXmls,
  RawXmlQuotaError,
  setRawXmlDbOpenerForTests,
  toRawXmlRecord,
} from "@/lib/store/raw-xml-store";

type Row = ReturnType<typeof toRawXmlRecord>;

function createMemoryRawXmlDb(options?: { failQuotaOnPut?: boolean }) {
  const rows = new Map<string, Row>();

  const makeReq = <T,>(getResult: () => T) => {
    const req: {
      result?: T;
      onsuccess: ((ev: Event) => void) | null;
      onerror: ((ev: Event) => void) | null;
    } = { onsuccess: null, onerror: null };
    queueMicrotask(() => {
      req.result = getResult();
      req.onsuccess?.(new Event("success"));
    });
    return req;
  };

  const db = {
    close() {},
    transaction(_storeName: string, mode: IDBTransactionMode) {
      let cursorUsed = false;
      const storeApi = {
        put(row: Row) {
          if (options?.failQuotaOnPut && mode === "readwrite") {
            const err = new DOMException("Quota exceeded", "QuotaExceededError");
            queueMicrotask(() => {
              tx.error = err;
              tx.onerror?.(new Event("error") as never);
              tx.onabort?.(new Event("abort") as never);
            });
            return;
          }
          rows.set(row.id, structuredClone(row));
        },
        get(id: string) {
          return makeReq(() => rows.get(id) as Row | undefined);
        },
        index(name: string) {
          if (name !== "batchId") throw new Error(`unexpected index ${name}`);
          return {
            getAll(batchId: string) {
              return makeReq(() => [...rows.values()].filter((r) => r.batchId === batchId));
            },
            count(batchId: string) {
              return makeReq(
                () => [...rows.values()].filter((r) => r.batchId === batchId).length,
              );
            },
            openCursor(range: { lower?: string } | string) {
              cursorUsed = true;
              const batchId =
                typeof range === "string" ? range : String(range?.lower ?? "");
              const list = [...rows.values()].filter((r) => r.batchId === batchId);
              let idx = 0;
              const req: {
                result?: { value: Row; delete: () => void; continue: () => void } | null;
                onsuccess: ((ev: Event) => void) | null;
                onerror: ((ev: Event) => void) | null;
              } = { onsuccess: null, onerror: null };

              const emit = () => {
                if (idx >= list.length) {
                  req.result = null;
                  req.onsuccess?.(new Event("success"));
                  queueMicrotask(() => tx.oncomplete?.(new Event("complete")));
                  return;
                }
                const row = list[idx];
                req.result = {
                  value: row,
                  delete: () => {
                    rows.delete(row.id);
                  },
                  continue: () => {
                    idx += 1;
                    queueMicrotask(emit);
                  },
                };
                req.onsuccess?.(new Event("success"));
              };
              queueMicrotask(emit);
              return req;
            },
          };
        },
      };

      const tx: {
        objectStore: () => typeof storeApi;
        oncomplete: ((ev: Event) => void) | null;
        onerror: ((ev: Event) => void) | null;
        onabort: ((ev: Event) => void) | null;
        error: DOMException | null;
      } = {
        objectStore: () => storeApi,
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
      };

      if (!(options?.failQuotaOnPut && mode === "readwrite")) {
        queueMicrotask(() => {
          if (!cursorUsed) tx.oncomplete?.(new Event("complete"));
        });
      }
      return tx;
    },
  };

  return { db: db as unknown as IDBDatabase, rows };
}

afterEach(() => {
  setRawXmlDbOpenerForTests(null);
});

describe("rawXml IndexedDB repository", () => {
  it("writes and reads original XML by document id", async () => {
    const mem = createMemoryRawXmlDb();
    setRawXmlDbOpenerForTests(async () => mem.db);
    await idbPutRawXmls([
      {
        batchId: "b1",
        documentId: "d1",
        fileName: "a.xml",
        xmlHash: "h1",
        content: "<nfe/>",
      },
    ]);
    const got = await idbGetRawXml("b1", "d1");
    expect(got?.content).toBe("<nfe/>");
    expect(got?.xmlHash).toBe("h1");
  });

  it("deletes all XMLs for a batch", async () => {
    const mem = createMemoryRawXmlDb();
    setRawXmlDbOpenerForTests(async () => mem.db);
    (globalThis as { IDBKeyRange: { only: (v: string) => { lower: string; upper: string } } }).IDBKeyRange =
      {
        only: (v: string) => ({ lower: v, upper: v }),
      };

    await idbPutRawXmls([
      { batchId: "b1", documentId: "d1", fileName: "a.xml", xmlHash: "h1", content: "<a/>" },
      { batchId: "b1", documentId: "d2", fileName: "b.xml", xmlHash: "h2", content: "<b/>" },
      { batchId: "b2", documentId: "d3", fileName: "c.xml", xmlHash: "h3", content: "<c/>" },
    ]);
    const deleted = await idbDeleteRawXmlsForBatch("b1");
    expect(deleted).toBe(2);
    expect(await idbGetRawXml("b1", "d1")).toBeNull();
    expect(await idbGetRawXml("b2", "d3")).not.toBeNull();
  });

  it("surfaces QuotaExceededError as RawXmlQuotaError", async () => {
    const mem = createMemoryRawXmlDb({ failQuotaOnPut: true });
    setRawXmlDbOpenerForTests(async () => mem.db);
    await expect(
      idbPutRawXmls([
        { batchId: "b1", documentId: "d1", fileName: "a.xml", xmlHash: "h1", content: "<a/>" },
      ]),
    ).rejects.toBeInstanceOf(RawXmlQuotaError);
  });

  it("never invents content for missing records (old batches)", async () => {
    const mem = createMemoryRawXmlDb();
    setRawXmlDbOpenerForTests(async () => mem.db);
    expect(await idbGetRawXml("old-batch", "doc")).toBeNull();
  });
});
