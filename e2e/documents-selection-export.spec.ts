import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * Seeds IndexedDB with a tiny synthetic batch + rawXml so the documents hub
 * can be exercised without real fiscal XMLs.
 */
async function seedBatch(page: import("@playwright/test").Page) {
  await page.goto("/app");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(async () => {
    const DB = "xml-fiscal-intelligence";
    const VERSION = 2;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains("batches")) {
          database.createObjectStore("batches", { keyPath: "batch.id" });
        }
        if (!database.objectStoreNames.contains("rawXml")) {
          const raw = database.createObjectStore("rawXml", { keyPath: "id" });
          raw.createIndex("batchId", "batchId", { unique: false });
          raw.createIndex("documentId", "documentId", { unique: false });
          raw.createIndex("xmlHash", "xmlHash", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const now = new Date().toISOString();
    const store = {
      batch: {
        id: "e2e-batch-1",
        workspaceId: "ws_local_demo",
        name: "e2e-lote",
        uploadedFileName: "e2e.zip",
        status: "completed",
        totalFiles: 2,
        totalXml: 2,
        validXml: 2,
        invalidXml: 0,
        nfeCount: 2,
        cteCount: 0,
        nfseCount: 0,
        unknownCount: 0,
        duplicateCount: 0,
        totalValue: 150,
        healthScore: 88,
        progress: 100,
        progressMessage: "ok",
        createdAt: now,
        updatedAt: now,
        month: 6,
        year: 2026,
      },
      documents: [
        {
          id: "doc-a",
          workspaceId: "ws_local_demo",
          batchId: "e2e-batch-1",
          documentType: "NFE",
          fileName: "a.xml",
          number: "1001",
          series: "1",
          model: "55",
          issueDate: "2026-06-15T10:00:00.000Z",
          emitterName: "Empresa Alpha",
          emitterDoc: "11222333000181",
          receiverName: "Cliente Beta",
          receiverDoc: "12345678901",
          emitterUf: "SP",
          receiverUf: "RJ",
          totalValue: 100,
          accessKey: "35260611222333000181550010000010011234567890",
          protocol: "90",
          natureOperation: "Venda",
          cfopMain: "5102",
          parseStatus: "ok",
          parseErrors: [],
          rawJson: {},
          flattenedJson: { "ide.mod": "55", "ide.nNF": "1001" },
          createdAt: now,
          qualityScore: 90,
        },
        {
          id: "doc-b",
          workspaceId: "ws_local_demo",
          batchId: "e2e-batch-1",
          documentType: "NFE",
          fileName: "b.xml",
          number: "2002",
          series: "1",
          issueDate: "2026-06-16T10:00:00.000Z",
          emitterName: "Empresa Gamma",
          emitterDoc: "99888777000166",
          receiverName: "Cliente Delta",
          emitterUf: "MG",
          receiverUf: "SP",
          totalValue: 50,
          accessKey: "35260699888777000166550010000020021234567890",
          parseStatus: "ok",
          parseErrors: [],
          rawJson: {},
          flattenedJson: {},
          createdAt: now,
          qualityScore: 80,
        },
      ],
      items: [],
      fields: [],
      errors: [],
      exports: [],
      findings: [],
      relationships: [],
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["batches", "rawXml"], "readwrite");
      tx.objectStore("batches").put(store);
      tx.objectStore("rawXml").put({
        id: "e2e-batch-1:doc-a",
        batchId: "e2e-batch-1",
        documentId: "doc-a",
        fileName: "a.xml",
        xmlHash: "hash-a",
        content: "<NFe><infNFe Id=\"NFeA\"/></NFe>",
        byteLength: 34,
        createdAt: now,
      });
      tx.objectStore("rawXml").put({
        id: "e2e-batch-1:doc-b",
        batchId: "e2e-batch-1",
        documentId: "doc-b",
        fileName: "b.xml",
        xmlHash: "hash-b",
        content: "<NFe><infNFe Id=\"NFeB\"/></NFe>",
        byteLength: 34,
        createdAt: now,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  const seeded = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("xml-fiscal-intelligence", 2);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const row = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction("batches", "readonly");
      const req = tx.objectStore("batches").get("e2e-batch-1");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return Boolean(row);
  });
  if (!seeded) throw new Error("Falha ao semear IndexedDB para e2e");
}

test.describe("documents selection export hub", () => {
  test.describe.configure({ mode: "serial" });

  test("workspace: filter emitente → select → export TXT", async ({ page }) => {
    await seedBatch(page);
    await page.goto("/app/batches/e2e-batch-1/documents");

    await expect(page.getByRole("heading", { name: /Documentos/i })).toBeVisible({
      timeout: 15_000,
    });

    // Free-text filter applied only on button (not per keystroke)
    await page.getByPlaceholder("Busca livre").fill("Alpha");
    await page.getByRole("button", { name: /Aplicar filtros de texto/i }).click();
    await expect(page.getByText(/1 documentos/i)).toBeVisible();

    const headerCb = page.getByLabel("Selecionar todos os resultados filtrados");
    await headerCb.check();
    await expect(page.getByLabel("Ações da seleção")).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: /^Exportar selecionados$/i }).click();
    await expect(page.getByRole("dialog", { name: /Central de exportação/i })).toBeVisible();

    await page.getByRole("button", { name: /^Continuar$/i }).click();
    await page.getByRole("button", { name: /TXT de chaves/i }).click();
    await page.getByRole("button", { name: /^Continuar$/i }).click();
    await page.getByRole("button", { name: /^Continuar$/i }).click();
    await page.getByRole("button", { name: /Gerar e baixar/i }).click();

    const download = await downloadPromise;
    const name = download.suggestedFilename();
    expect(name).toMatch(/chaves-selecionadas/i);

    const tmp = path.join(os.tmpdir(), name);
    await download.saveAs(tmp);
    const content = fs.readFileSync(tmp, "utf8").trim();
    expect(content).toBe("35260611222333000181550010000010011234567890");
    fs.unlinkSync(tmp);
  });

  test("defaults 13 fields visible in picker", async ({ page }) => {
    await seedBatch(page);
    await page.goto("/app/batches/e2e-batch-1/documents");
    await expect(page.getByText(/Padrão \(13 colunas\)/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/CHAVE DE ACESSO/i).first()).toBeVisible();
    await expect(page.getByText(/CCASSTRIB/i).first()).toBeVisible();
  });

  test("global multilote route loads", async ({ page }) => {
    await seedBatch(page);
    await page.goto("/app/documents");
    await expect(page.getByRole("heading", { name: /Documentos \(multilote\)/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
