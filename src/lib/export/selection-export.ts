import type { BatchStore } from "@/types";
import {
  buildExportDataset,
  buildExportPreflight,
  type BuildExportDatasetOptions,
  type ExportCsvProfile,
  type ExportJsonProfile,
  type ExportPreflight,
  type ExportPrivacyProfile,
  type PackageArtifact,
} from "@/lib/export/v2";
import { buildWorkbookFromDataset } from "@/lib/export/v2/excel";
import {
  buildDocumentsCsvFromDataset,
  buildItemsCsvFromDataset,
} from "@/lib/export/v2/csv";
import { buildJsonFromDataset } from "@/lib/export/v2/json";
import { buildHtmlFromDataset } from "@/lib/export/v2/html";
import { buildKeysTxtFromDataset } from "@/lib/export/v2/keys";
import { buildCompletePackage, buildCsvPackageZip } from "@/lib/export/v2/package";
import { selectionExportFilename } from "@/lib/export/filenames";
import { buildSelectedXmlZip } from "@/lib/export/xml-zip";
import { uniqueZipEntryName } from "@/lib/export/filenames";
import type { RawXmlRecord } from "@/lib/store/raw-xml-store";
import { resolveSelectionAcrossStores } from "@/lib/export/resolve-selection";

export type SelectionExportFormat =
  | "xml-zip"
  | "xlsx"
  | "csv-docs"
  | "csv-items"
  | "csv-zip"
  | "json"
  | "json-flat"
  | "jsonl"
  | "html"
  | "keys-txt"
  | "package";

export type SelectionExportProgress =
  | "preparing"
  | "preflight"
  | "reading_xml"
  | "building"
  | "downloading"
  | "done"
  | "canceled"
  | "error";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2_000);
  }
}

export type RunSelectionExportInput = {
  /** Preferred: all workspace stores for multilote parity. */
  stores?: BatchStore[];
  /** Legacy single-store export. Used when `stores` is omitted. */
  store?: BatchStore;
  /**
   * Document ids or composite `batchId:documentId` selection ids.
   * Multilote must use composite ids.
   */
  selectedIds: string[];
  format: SelectionExportFormat;
  filters?: Record<string, unknown>;
  rawByDocumentId?: Map<string, RawXmlRecord>;
  organizeXmlByType?: boolean;
  allowPartialXml?: boolean;
  privacyProfile?: ExportPrivacyProfile;
  csvProfile?: ExportCsvProfile;
  jsonProfile?: ExportJsonProfile;
  packageArtifacts?: PackageArtifact[];
  competenceAcknowledged?: boolean;
  signal?: AbortSignal;
  onProgress?: (step: SelectionExportProgress, detail?: string) => void;
};

export type RunSelectionExportResult = {
  ok: boolean;
  filename?: string;
  message?: string;
  missingIds?: string[];
  missingXmlIds?: string[];
  withoutKey?: number;
  preflight?: ExportPreflight;
  generationId?: string;
  requiresCompetenceAck?: boolean;
  batchCount?: number;
};

function resolveStoreAndIds(input: RunSelectionExportInput): {
  store: BatchStore;
  documentIds: string[];
  batchCount: number;
  missingCompositeIds: string[];
} {
  const stores = input.stores?.length
    ? input.stores
    : input.store
      ? [input.store]
      : [];
  if (!stores.length) {
    throw new Error("Nenhum lote informado para exportação");
  }
  const resolved = resolveSelectionAcrossStores(stores, input.selectedIds);
  return {
    store: resolved.store,
    documentIds: resolved.documentIds,
    batchCount: resolved.batchCount,
    missingCompositeIds: resolved.missingCompositeIds,
  };
}

export function previewExportPreflight(
  storeOrStores: BatchStore | BatchStore[],
  selectedIds: string[],
  options: BuildExportDatasetOptions = {},
): ExportPreflight {
  const stores = Array.isArray(storeOrStores) ? storeOrStores : [storeOrStores];
  const resolved = resolveSelectionAcrossStores(stores, selectedIds);
  const rawXmlAvailability = (options.rawXmlAvailability || []).length
    ? options.rawXmlAvailability
    : undefined;
  const dataset = buildExportDataset(resolved.store, resolved.documentIds, {
    ...options,
    rawXmlAvailability,
  });
  return buildExportPreflight(dataset, "excel_pt_br");
}

export async function runSelectionExport(
  input: RunSelectionExportInput,
): Promise<RunSelectionExportResult> {
  const {
    format,
    filters,
    rawByDocumentId,
    organizeXmlByType,
    allowPartialXml,
    privacyProfile = "operational_full",
    csvProfile = "excel_pt_br",
    jsonProfile = "compact",
    packageArtifacts = ["xlsx", "csv", "json", "html", "keys"],
    competenceAcknowledged,
    signal,
    onProgress,
  } = input;

  const throwIfCanceled = () => {
    if (signal?.aborted) {
      onProgress?.("canceled");
      throw new DOMException("Exportação cancelada", "AbortError");
    }
  };

  onProgress?.("preparing", "Montando dataset canônico");
  throwIfCanceled();

  const { store, documentIds, batchCount, missingCompositeIds } = resolveStoreAndIds(input);
  const selectedIds = documentIds;

  const effectivePrivacy: ExportPrivacyProfile =
    format === "xml-zip" || (format === "package" && packageArtifacts.includes("xml"))
      ? "operational_full"
      : privacyProfile;

  const rawAvail =
    rawByDocumentId != null
      ? selectedIds.map((id) => {
          const raw = rawByDocumentId.get(id);
          return {
            documentId: id,
            available: Boolean(raw?.content),
            fileName: raw?.fileName,
            xmlHash: raw?.xmlHash,
          };
        })
      : undefined;

  const dataset = buildExportDataset(store, selectedIds, {
    filters,
    privacyProfile: effectivePrivacy,
    includeRawStructures: jsonProfile === "audit_full" || format === "json-flat",
    rawXmlAvailability: rawAvail,
  });
  if (missingCompositeIds.length) {
    dataset.selection.missingIds = [
      ...new Set([...dataset.selection.missingIds, ...missingCompositeIds]),
    ];
  }

  onProgress?.("preflight", "Verificando pré-voo");
  const preflight = buildExportPreflight(dataset, csvProfile);

  if (!dataset.documents.length) {
    return {
      ok: false,
      message: "Nenhum documento válido na seleção (IDs inexistentes ou excluídos).",
      missingIds: dataset.selection.missingIds,
      preflight,
      batchCount,
    };
  }

  if (preflight.requiresCompetenceAck && !competenceAcknowledged) {
    return {
      ok: false,
      requiresCompetenceAck: true,
      message:
        "A competência informada diverge do período real dos documentos. Confirme para continuar.",
      preflight,
      generationId: dataset.manifest.generationId,
      batchCount,
    };
  }

  const batchLabel = store.batch.name || store.batch.id;
  const gid = dataset.manifest.generationId;
  onProgress?.("building", `Montando ${format}`);
  throwIfCanceled();

  if (format === "xml-zip") {
    onProgress?.("reading_xml", "Lendo XMLs locais");
    throwIfCanceled();
    const result = await buildSelectedXmlZip({
      store,
      selectedDocuments: store.documents.filter((d) =>
        dataset.selection.foundIds.includes(d.id),
      ),
      rawByDocumentId: rawByDocumentId || new Map(),
      filters,
      organizeByType: organizeXmlByType,
      allowPartial: allowPartialXml,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        missingXmlIds: result.missingDocumentIds,
        preflight,
        batchCount,
      };
    }
    const filename = selectionExportFilename("xml-zip", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(result.blob, filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      missingXmlIds: result.missingDocumentIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "xlsx") {
    const buffer = await buildWorkbookFromDataset(dataset);
    const filename = selectionExportFilename("xlsx", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(
      new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename,
    );
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "csv-docs") {
    const csv = buildDocumentsCsvFromDataset(dataset, csvProfile);
    const filename = selectionExportFilename("csv-docs", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "csv-items") {
    const csv = buildItemsCsvFromDataset(dataset, csvProfile);
    const filename = selectionExportFilename("csv-items", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "csv-zip") {
    const blob = await buildCsvPackageZip(dataset, csvProfile);
    const filename = selectionExportFilename("csv-zip", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(blob, filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "json" || format === "json-flat") {
    const profile: ExportJsonProfile =
      format === "json-flat" ? "flat" : jsonProfile === "audit_full" ? "audit_full" : "compact";
    const text = buildJsonFromDataset(
      format === "json-flat"
        ? buildExportDataset(store, selectedIds, {
            filters,
            privacyProfile: effectivePrivacy,
            includeRawStructures: true,
            rawXmlAvailability: rawAvail,
          })
        : dataset,
      profile,
    );
    const filename = selectionExportFilename("json", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([text], { type: "application/json" }), filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "jsonl") {
    const text = buildJsonFromDataset(dataset, "jsonl");
    const filename = selectionExportFilename("jsonl", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([text], { type: "application/x-ndjson" }), filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "html") {
    const html = buildHtmlFromDataset(dataset);
    const filename = selectionExportFilename("html", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "keys-txt") {
    const rawKeys = new Map<string, string>();
    for (const d of store.documents) {
      if (dataset.selection.foundIds.includes(d.id) && d.accessKey) {
        rawKeys.set(d.id, d.accessKey);
      }
    }
    if (effectivePrivacy !== "operational_full") {
      return {
        ok: false,
        message:
          "TXT de chaves exige perfil operacional completo (chaves de 44 dígitos para sistemas externos).",
        preflight,
        batchCount,
      };
    }
    const keys = buildKeysTxtFromDataset(dataset, { rawKeysByDocumentId: rawKeys });
    const filename = selectionExportFilename("keys-txt", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([keys.text], { type: "text/plain;charset=utf-8" }), filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      withoutKey: keys.withoutKey,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  if (format === "package") {
    const arts = [...packageArtifacts];
    if (arts.includes("xml") && privacyProfile !== "operational_full") {
      return {
        ok: false,
        message:
          "ZIP de XML no pacote completo exige privacidade operacional (conteúdo XML não pode ser mascarado).",
        preflight,
        batchCount,
      };
    }

    const xmlEntries: Array<{ path: string; content: string | Uint8Array }> = [];
    if (arts.includes("xml")) {
      onProgress?.("reading_xml", "Lendo XMLs locais");
      const used = new Set<string>();
      const docs = store.documents.filter((d) => dataset.selection.foundIds.includes(d.id));
      for (const doc of docs) {
        const raw = rawByDocumentId?.get(doc.id);
        if (!raw?.content) continue;
        const desired =
          doc.accessKey && /^\d{44}$/.test(doc.accessKey)
            ? `${doc.accessKey}.xml`
            : doc.fileName || `${doc.id}.xml`;
        const name = uniqueZipEntryName(desired, used);
        xmlEntries.push({ path: `xml/${name}`, content: raw.content });
      }
    }

    const result = await buildCompletePackage({
      dataset,
      artifacts: arts,
      csvProfile,
      jsonProfile: jsonProfile === "audit_full" ? "audit_full" : "compact",
      xmlEntries,
      signal,
      onProgress: (d) => onProgress?.("building", d),
    });
    const filename = selectionExportFilename("package", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(result.blob, filename);
    onProgress?.("done");
    return {
      ok: true,
      filename,
      missingIds: dataset.selection.missingIds,
      preflight,
      generationId: gid,
      batchCount,
    };
  }

  return { ok: false, message: `Formato não suportado: ${format}`, preflight, batchCount };
}
