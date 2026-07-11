export const GENERATION_MANIFEST_SCHEMA = "1.0.0";

export type GenerationManifest = {
  schemaVersion: string;
  generationId: string;
  generatedAt: string;
  timezone: string;
  appVersion: string;
  buildCommit: string;
  workspaceId: string;
  companyId?: string;
  establishmentId?: string;
  fiscalPeriod?: string;
  batchIds: string[];
  filters: Record<string, unknown>;
  recordCounts: Record<string, number>;
  emptyReason?: string;
  parserVersions: string[];
  ruleSetVersions: string[];
  schemaVersions: string[];
  sourceHashes: string[];
  outputHashes: Record<string, string>;
  disclaimer: string;
};

export type ExportEnvelope<T> = {
  schemaVersion: string;
  manifest: GenerationManifest;
  data: T;
  emptyReason?: string;
};

/** Works in browser and Node (Web Crypto / randomUUID). */
export function createGenerationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildGenerationManifest(input: {
  workspaceId: string;
  batchIds: string[];
  recordCounts: Record<string, number>;
  filters?: Record<string, unknown>;
  emptyReason?: string;
  companyId?: string;
  establishmentId?: string;
  fiscalPeriod?: string;
  parserVersions?: string[];
  ruleSetVersions?: string[];
  schemaVersions?: string[];
  sourceHashes?: string[];
  outputHashes?: Record<string, string>;
}): GenerationManifest {
  const totalRecords = Object.values(input.recordCounts).reduce((a, b) => a + b, 0);
  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    timezone = "UTC";
  }
  return {
    schemaVersion: GENERATION_MANIFEST_SCHEMA,
    generationId: createGenerationId(),
    generatedAt: new Date().toISOString(),
    timezone,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    buildCommit:
      (typeof process !== "undefined" &&
        (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.GIT_COMMIT)) ||
      "local",
    workspaceId: input.workspaceId,
    companyId: input.companyId,
    establishmentId: input.establishmentId,
    fiscalPeriod: input.fiscalPeriod,
    batchIds: input.batchIds,
    filters: input.filters || {},
    recordCounts: input.recordCounts,
    emptyReason:
      input.emptyReason || (totalRecords === 0 ? "no_records_in_selection" : undefined),
    parserVersions: input.parserVersions || ["xml-fiscal-parser@local"],
    ruleSetVersions: input.ruleSetVersions || [],
    schemaVersions: input.schemaVersions || [],
    sourceHashes: input.sourceHashes || [],
    outputHashes: input.outputHashes || {},
    disclaimer:
      "Exportação analítica interna. Não constitui apuração oficial, SPED validado pelo PVA nem conformidade fiscal automática.",
  };
}

export function wrapExportEnvelope<T>(
  data: T,
  manifest: GenerationManifest,
  emptyReason?: string,
): ExportEnvelope<T> {
  return {
    schemaVersion: GENERATION_MANIFEST_SCHEMA,
    manifest,
    data,
    emptyReason: emptyReason || manifest.emptyReason,
  };
}

export function emptyReasonForStore(store: {
  documents: unknown[];
  batch: { incremental?: boolean; newDocumentCount?: number; skippedDuplicateCount?: number };
}): string | undefined {
  if (store.documents.length > 0) return undefined;
  if (store.batch.incremental && (store.batch.newDocumentCount ?? 0) === 0) {
    return "all_documents_reused";
  }
  if ((store.batch.skippedDuplicateCount ?? 0) > 0) return "all_documents_reused";
  return "no_documents_in_batch";
}
