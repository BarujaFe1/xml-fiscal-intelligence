import { v4 as uuidv4 } from "uuid";
import { parseXmlDocument } from "@/lib/parser";
import { calculateBatchQuality } from "@/lib/quality";
import { sha256Hex } from "@/lib/security/hash";
import { extractXmlFromZip } from "@/lib/zip/extract";
import { runFiscalAudit } from "@/modules/audit/fiscal-audit-engine";
import { buildDocumentRelationships } from "@/modules/relationships";
import type {
  Batch,
  BatchStore,
  DocumentType,
  ImportLog,
  ParseError,
} from "@/types";

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
  /** Skip XMLs whose SHA-256 already exists in prior batches. */
  incremental?: boolean;
  /** Known XML hashes from previous imports (workspace). */
  knownHashes?: Set<string> | string[];
  onProgress?: (progress: number, message: string) => Promise<void> | void;
}

function log(
  batchId: string,
  level: ImportLog["level"],
  step: string,
  message: string,
  metadata?: Record<string, unknown>,
): ImportLog {
  return {
    id: uuidv4(),
    batchId,
    level,
    step,
    message,
    metadata,
    createdAt: new Date().toISOString(),
  };
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
  const incremental = input.incremental ?? false;
  const knownHashes = new Set(
    input.knownHashes instanceof Set
      ? [...input.knownHashes]
      : input.knownHashes || [],
  );

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
    skippedDuplicateCount: 0,
    newDocumentCount: 0,
    totalValue: 0,
    healthScore: null,
    progress: 5,
    progressMessage: "Extraindo ZIP com segurança...",
    createdAt: now,
    updatedAt: now,
    incremental,
  };

  const importLogs: ImportLog[] = [
    log(batchId, "info", "start", `Iniciando importação de ${input.fileName}`, {
      incremental,
      knownHashCount: knownHashes.size,
    }),
  ];

  const store: BatchStore = {
    batch,
    documents: [],
    items: [],
    fields: [],
    errors: [],
    exports: [],
    findings: [],
    relationships: [],
    importLogs,
  };

  await input.onProgress?.(5, batch.progressMessage);

  const extracted = await extractXmlFromZip(input.buffer);
  batch.totalFiles = extracted.totalFiles;
  batch.totalXml = extracted.xmlFiles.length;
  batch.progress = 15;
  batch.progressMessage = `${extracted.xmlFiles.length} XMLs encontrados. Processando...`;
  importLogs.push(
    log(batchId, "info", "extract", batch.progressMessage, {
      totalFiles: extracted.totalFiles,
      skipped: extracted.skipped.length,
    }),
  );
  await input.onProgress?.(15, batch.progressMessage);

  const seenKeys = new Map<string, string>();
  const seenHashes = new Map<string, string>();
  const errors: ParseError[] = [];
  let skippedIncremental = 0;

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
      importLogs.push(
        log(batchId, "warn", "extract", `Arquivo ignorado: ${skipped.path}`, {
          reason: skipped.reason,
        }),
      );
    }
  }

  for (let i = 0; i < extracted.xmlFiles.length; i++) {
    const file = extracted.xmlFiles[i];
    const xmlHash = await sha256Hex(file.content);

    if (incremental && knownHashes.has(xmlHash)) {
      skippedIncremental += 1;
      if (skippedIncremental <= 20 || skippedIncremental % 50 === 0) {
        importLogs.push(
          log(batchId, "info", "incremental_skip", `Já importado (hash): ${file.fileName}`, {
            xmlHash,
          }),
        );
      }
      const pct = 15 + Math.round(((i + 1) / Math.max(extracted.xmlFiles.length, 1)) * 70);
      batch.progress = pct;
      batch.progressMessage = `Incremental: pulando ${file.fileName} (${skippedIncremental} já conhecidos)`;
      if (i % 25 === 0 || i === extracted.xmlFiles.length - 1) {
        await input.onProgress?.(pct, batch.progressMessage);
      }
      continue;
    }

    const result = parseXmlDocument({
      xml: file.content,
      fileName: file.fileName,
      batchId,
      workspaceId,
    });

    result.document.xmlHash = xmlHash;

    // In-batch hash duplicate
    const priorByHash = seenHashes.get(xmlHash);
    if (priorByHash) {
      result.document.isDuplicate = true;
      result.document.duplicateOfId = priorByHash;
    } else {
      seenHashes.set(xmlHash, result.document.id);
    }

    // In-batch access key duplicate
    if (result.document.accessKey) {
      const priorByKey = seenKeys.get(result.document.accessKey);
      if (priorByKey) {
        result.document.isDuplicate = true;
        result.document.duplicateOfId = result.document.duplicateOfId || priorByKey;
      } else {
        seenKeys.set(result.document.accessKey, result.document.id);
      }
    }

    if (!keepRawJson) {
      result.document.rawJson = {};
    }

    store.documents.push(result.document);
    store.items.push(...result.items);
    if (keepFields) store.fields.push(...result.fields);
    if (result.error) {
      errors.push(result.error);
      importLogs.push(
        log(batchId, "error", "parse", result.error.errorMessage, {
          fileName: file.fileName,
        }),
      );
    }

    const pct = 15 + Math.round(((i + 1) / Math.max(extracted.xmlFiles.length, 1)) * 70);
    batch.progress = pct;
    batch.progressMessage = `Processando ${i + 1}/${extracted.xmlFiles.length}: ${file.fileName}`;
    batch.updatedAt = new Date().toISOString();

    if (i % 10 === 0 || i === extracted.xmlFiles.length - 1) {
      await input.onProgress?.(pct, batch.progressMessage);
    }
  }

  batch.skippedDuplicateCount = skippedIncremental;
  batch.newDocumentCount = store.documents.length;

  const countType = (t: DocumentType) => store.documents.filter((d) => d.documentType === t).length;
  batch.nfeCount = countType("NFE") + countType("NFCE");
  batch.cteCount = countType("CTE");
  batch.nfseCount = countType("NFSE");
  batch.unknownCount =
    countType("UNKNOWN") +
    countType("EVENT") +
    countType("CANCELATION") +
    countType("CORRECTION_LETTER");
  batch.validXml = store.documents.filter((d) => d.parseStatus !== "error").length;
  batch.invalidXml = store.documents.length - batch.validXml;
  batch.duplicateCount = store.documents.filter((d) => d.isDuplicate).length;
  batch.totalValue = store.documents.reduce((acc, d) => acc + (d.totalValue || 0), 0);

  batch.progress = 88;
  batch.progressMessage = "Executando auditoria fiscal…";
  await input.onProgress?.(88, batch.progressMessage);

  const findings = runFiscalAudit({
    batch,
    documents: store.documents,
    items: store.items,
  });
  store.findings = findings;
  importLogs.push(
    log(batchId, "info", "audit", `${findings.length} achados gerados`, {
      bySeverity: findings.reduce(
        (acc, f) => {
          acc[f.severity] = (acc[f.severity] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    }),
  );

  batch.progress = 93;
  batch.progressMessage = "Inferindo relacionamentos…";
  await input.onProgress?.(93, batch.progressMessage);

  const relationships = buildDocumentRelationships({
    workspaceId,
    documents: store.documents,
    items: store.items,
  });
  store.relationships = relationships;
  importLogs.push(
    log(batchId, "info", "relationships", `${relationships.length} vínculos inferidos`),
  );

  const quality = calculateBatchQuality(batch, store.documents, store.items, store.fields, errors, {
    reusedDocumentCount: skippedIncremental,
  });
  batch.healthScore = quality.score;
  batch.quality = quality;
  batch.status =
    batch.invalidXml > 0 && batch.validXml > 0
      ? "partial"
      : batch.validXml || skippedIncremental
        ? "completed"
        : "failed";
  batch.progress = 100;
  batch.progressMessage =
    skippedIncremental > 0
      ? `Concluído · ${batch.newDocumentCount} novos · ${skippedIncremental} já conhecidos`
      : "Processamento concluído";
  batch.updatedAt = new Date().toISOString();

  importLogs.push(
    log(batchId, "info", "done", batch.progressMessage, {
      healthScore: batch.healthScore,
      documents: store.documents.length,
      items: store.items.length,
      findings: findings.length,
      relationships: relationships.length,
    }),
  );

  store.errors = errors;
  store.batch = batch;
  store.importLogs = importLogs;
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
