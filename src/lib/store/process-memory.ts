import { v4 as uuidv4 } from "uuid";
import { parseXmlDocument } from "@/lib/parser";
import { calculateBatchQuality } from "@/lib/quality";
import { extractXmlFromZip } from "@/lib/zip/extract";
import type { Batch, BatchStore, DocumentType, ParseError } from "@/types";

export interface ProcessZipMemoryInput {
  buffer: ArrayBuffer | Buffer;
  fileName: string;
  name?: string;
  cnpjLabel?: string;
  month?: number;
  year?: number;
  workspaceId?: string;
  /** Keep full rawJson (larger payload). Default false for cloud import. */
  keepRawJson?: boolean;
  /** Persist key-value fields array. Default false — UI can derive from flattenedJson. */
  keepFields?: boolean;
  onProgress?: (progress: number, message: string) => Promise<void> | void;
}

/**
 * Process a ZIP entirely in memory (browser or server).
 * Does not touch the filesystem — caller persists the store.
 */
export async function processZipBatchInMemory(
  input: ProcessZipMemoryInput,
): Promise<BatchStore> {
  const workspaceId = input.workspaceId || "ws_local_demo";
  const batchId = uuidv4();
  const now = new Date().toISOString();
  const keepRawJson = input.keepRawJson ?? false;
  const keepFields = input.keepFields ?? false;

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

  const store: BatchStore = {
    batch,
    documents: [],
    items: [],
    fields: [],
    errors: [],
    exports: [],
  };

  await input.onProgress?.(5, batch.progressMessage);

  const extracted = await extractXmlFromZip(input.buffer);
  batch.totalFiles = extracted.totalFiles;
  batch.totalXml = extracted.xmlFiles.length;
  batch.progress = 15;
  batch.progressMessage = `${extracted.xmlFiles.length} XMLs encontrados. Processando...`;
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

    if (!keepRawJson) {
      result.document.rawJson = {};
    }

    store.documents.push(result.document);
    store.items.push(...result.items);
    if (keepFields) store.fields.push(...result.fields);
    if (result.error) errors.push(result.error);

    if (result.document.accessKey) {
      seenKeys.set(result.document.accessKey, (seenKeys.get(result.document.accessKey) || 0) + 1);
    }

    const pct = 15 + Math.round(((i + 1) / Math.max(extracted.xmlFiles.length, 1)) * 75);
    batch.progress = pct;
    batch.progressMessage = `Processando ${i + 1}/${extracted.xmlFiles.length}: ${file.fileName}`;
    batch.updatedAt = new Date().toISOString();

    if (i % 10 === 0 || i === extracted.xmlFiles.length - 1) {
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
  batch.status =
    batch.invalidXml > 0 && batch.validXml > 0 ? "partial" : batch.validXml ? "completed" : "failed";
  batch.progress = 100;
  batch.progressMessage = "Processamento concluído";
  batch.updatedAt = new Date().toISOString();

  store.errors = errors;
  store.batch = batch;
  await input.onProgress?.(100, batch.progressMessage);
  return store;
}

/** Rebuild a nested object from flattened paths for the tree viewer. */
export function inflateFromFlattened(
  flat: Record<string, string | number | boolean | null>,
): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [pathKey, value] of Object.entries(flat)) {
    const parts = pathKey.split(".").filter(Boolean);
    let cur: Record<string, unknown> = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        const idx = Number(arrayMatch[2]);
        if (!Array.isArray(cur[key])) cur[key] = [];
        const arr = cur[key] as unknown[];
        if (i === parts.length - 1) {
          arr[idx] = value;
        } else {
          if (!arr[idx] || typeof arr[idx] !== "object") arr[idx] = {};
          cur = arr[idx] as Record<string, unknown>;
        }
      } else if (i === parts.length - 1) {
        cur[part] = value;
      } else {
        if (!cur[part] || typeof cur[part] !== "object") cur[part] = {};
        cur = cur[part] as Record<string, unknown>;
      }
    }
  }
  return root;
}
