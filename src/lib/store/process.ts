import { v4 as uuidv4 } from "uuid";
import { parseXmlDocument } from "@/lib/parser";
import { calculateBatchQuality } from "@/lib/quality";
import { DEFAULT_WORKSPACE_ID, saveBatchStore, saveRawXml } from "@/lib/store/fs-store";
import { extractXmlFromZip } from "@/lib/zip/extract";
import type { Batch, BatchStore, DocumentType, ParseError } from "@/types";

export interface ProcessZipInput {
  buffer: ArrayBuffer | Buffer;
  fileName: string;
  name?: string;
  cnpjLabel?: string;
  month?: number;
  year?: number;
  workspaceId?: string;
  onProgress?: (progress: number, message: string) => Promise<void> | void;
}

export async function processZipBatch(input: ProcessZipInput): Promise<BatchStore> {
  const workspaceId = input.workspaceId || DEFAULT_WORKSPACE_ID;
  const batchId = uuidv4();
  const now = new Date().toISOString();

  const batch: Batch = {
    id: batchId,
    workspaceId,
    name: input.name || input.fileName.replace(/\.zip$/i, ""),
    cnpjLabel: input.cnpjLabel,
    month: input.month,
    year: input.year,
    uploadedFileName: input.fileName,
    status: "processing",
    totalFiles: 0,
    totalXml: 0,
    validXml: 0,
    invalidXml: 0,
    nfeCount: 0,
    cteCount: 0,
    nfseCount: 0,
    unknownCount: 0,
    duplicateCount: 0,
    totalValue: 0,
    healthScore: 0,
    progress: 5,
    progressMessage: "Extraindo ZIP com segurança...",
    createdAt: now,
    updatedAt: now,
  };

  let store: BatchStore = {
    batch,
    documents: [],
    items: [],
    fields: [],
    errors: [],
    exports: [],
  };
  await saveBatchStore(store);
  await input.onProgress?.(5, batch.progressMessage);

  const extracted = await extractXmlFromZip(input.buffer);
  batch.totalFiles = extracted.totalFiles;
  batch.totalXml = extracted.xmlFiles.length;
  batch.progress = 15;
  batch.progressMessage = `${extracted.xmlFiles.length} XMLs encontrados. Processando...`;
  store = { ...store, batch };
  await saveBatchStore(store);
  await input.onProgress?.(15, batch.progressMessage);

  const seenKeys = new Map<string, number>();
  const errors: ParseError[] = [];

  for (const skipped of extracted.skipped) {
    if (skipped.reason === "dangerous_extension" || skipped.reason === "zip_slip_blocked") {
      errors.push({
        id: uuidv4(),
        workspaceId,
        batchId,
        fileName: skipped.path,
        errorType: skipped.reason,
        errorMessage: `Arquivo ignorado: ${skipped.reason}`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  for (let i = 0; i < extracted.xmlFiles.length; i++) {
    const file = extracted.xmlFiles[i];
    const result = parseXmlDocument({
      xml: file.content,
      fileName: file.fileName,
      batchId,
      workspaceId,
    });

    try {
      const rawPath = await saveRawXml(batchId, file.fileName, file.content);
      result.document.rawXmlPath = rawPath;
    } catch {
      // non-fatal
    }

    store.documents.push(result.document);
    store.items.push(...result.items);
    store.fields.push(...result.fields);
    if (result.error) errors.push(result.error);

    if (result.document.accessKey) {
      seenKeys.set(result.document.accessKey, (seenKeys.get(result.document.accessKey) || 0) + 1);
    }

    const pct = 15 + Math.round(((i + 1) / Math.max(extracted.xmlFiles.length, 1)) * 75);
    batch.progress = pct;
    batch.progressMessage = `Processando ${i + 1}/${extracted.xmlFiles.length}: ${file.fileName}`;
    batch.updatedAt = new Date().toISOString();

    if (i % 5 === 0 || i === extracted.xmlFiles.length - 1) {
      store = { ...store, batch, errors };
      await saveBatchStore(store);
      await input.onProgress?.(pct, batch.progressMessage);
    }
  }

  const countType = (t: DocumentType) => store.documents.filter((d) => d.documentType === t).length;
  batch.nfeCount = countType("NFE");
  batch.cteCount = countType("CTE");
  batch.nfseCount = countType("NFSE");
  batch.unknownCount = countType("UNKNOWN");
  batch.validXml = store.documents.filter((d) => d.parseStatus !== "error").length;
  batch.invalidXml = store.documents.length - batch.validXml;
  batch.duplicateCount = [...seenKeys.values()].filter((c) => c > 1).reduce((a, b) => a + (b - 1), 0);
  batch.totalValue = store.documents.reduce((acc, d) => acc + (d.totalValue || 0), 0);

  const quality = calculateBatchQuality(batch, store.documents, store.items, store.fields, errors);
  batch.healthScore = quality.score;
  batch.quality = quality;
  batch.status = batch.invalidXml > 0 && batch.validXml > 0 ? "partial" : batch.validXml ? "completed" : "failed";
  batch.progress = 100;
  batch.progressMessage = "Processamento concluído";
  batch.updatedAt = new Date().toISOString();

  store = { ...store, batch, errors };
  await saveBatchStore(store);
  await input.onProgress?.(100, batch.progressMessage);
  return store;
}
