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
  store: BatchStore;
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
  /** Required when preflight.requiresCompetenceAck */
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
};

export function previewExportPreflight(
  store: BatchStore,
  selectedIds: string[],
  options: BuildExportDatasetOptions = {},
): ExportPreflight {
  const rawXmlAvailability = (options.rawXmlAvailability || []).length
    ? options.rawXmlAvailability
    : undefined;
  const dataset = buildExportDataset(store, selectedIds, {
    ...options,
    rawXmlAvailability,
  });
  return buildExportPreflight(dataset, "excel_pt_br");
}

export async function runSelectionExport(
  input: RunSelectionExportInput,
): Promise<RunSelectionExportResult> {
  const {
    store,
    selectedIds,
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

  // XML ZIP requires operational_full — masking filenames does not anonymize XML content.
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

  onProgress?.("preflight", "Verificando pré-voo");
  const preflight = buildExportPreflight(dataset, csvProfile);

  if (!dataset.documents.length) {
    return {
      ok: false,
      message: "Nenhum documento válido na seleção (IDs inexistentes ou excluídos).",
      missingIds: dataset.selection.missingIds,
      preflight,
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
    };
  }

  const batchLabel = store.batch.name || store.batch.id;
  const gid = dataset.manifest.generationId;
  onProgress?.("building", `Montando ${format}`);
  throwIfCanceled();

  if (format === "xml-zip") {
    if (privacyProfile !== "operational_full") {
      // Soft warning path — still force full because XML cannot be masked meaningfully
    }
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
    return { ok: true, filename, missingIds: dataset.selection.missingIds, preflight, generationId: gid };
  }

  if (format === "csv-docs") {
    const csv = buildDocumentsCsvFromDataset(dataset, csvProfile);
    const filename = selectionExportFilename("csv-docs", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
    onProgress?.("done");
    return { ok: true, filename, missingIds: dataset.selection.missingIds, preflight, generationId: gid };
  }

  if (format === "csv-items") {
    const csv = buildItemsCsvFromDataset(dataset, csvProfile);
    const filename = selectionExportFilename("csv-items", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
    onProgress?.("done");
    return { ok: true, filename, missingIds: dataset.selection.missingIds, preflight, generationId: gid };
  }

  if (format === "csv-zip") {
    const blob = await buildCsvPackageZip(dataset, csvProfile);
    const filename = selectionExportFilename("csv-zip", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(blob, filename);
    onProgress?.("done");
    return { ok: true, filename, missingIds: dataset.selection.missingIds, preflight, generationId: gid };
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
    return { ok: true, filename, missingIds: dataset.selection.missingIds, preflight, generationId: gid };
  }

  if (format === "jsonl") {
    const text = buildJsonFromDataset(dataset, "jsonl");
    const filename = selectionExportFilename("jsonl", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([text], { type: "application/x-ndjson" }), filename);
    onProgress?.("done");
    return { ok: true, filename, missingIds: dataset.selection.missingIds, preflight, generationId: gid };
  }

  if (format === "html") {
    const html = buildHtmlFromDataset(dataset);
    const filename = selectionExportFilename("html", batchLabel, new Date(), gid);
    onProgress?.("downloading", filename);
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), filename);
    onProgress?.("done");
    return { ok: true, filename, missingIds: dataset.selection.missingIds, preflight, generationId: gid };
  }

  if (format === "keys-txt") {
    // Keys must be full 44-digit for interoperability — use raw keys from store
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
    };
  }

  return { ok: false, message: `Formato não suportado: ${format}`, preflight };
}
