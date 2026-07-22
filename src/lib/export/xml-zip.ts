import JSZip from "jszip";
import type { BatchStore, DocumentSummary } from "@/types";
import { buildGenerationManifest } from "@/lib/export/manifest";
import { uniqueZipEntryName, sanitizeExportFileName } from "@/lib/export/filenames";
import type { RawXmlRecord } from "@/lib/store/raw-xml-store";

export type XmlZipEntry = {
  documentId: string;
  entryName: string;
  xmlHash: string;
  fileName: string;
  byteLength: number;
};

export type XmlZipBuildInput = {
  store: BatchStore;
  selectedDocuments: DocumentSummary[];
  /** documentId → original XML record */
  rawByDocumentId: Map<string, RawXmlRecord>;
  filters?: Record<string, unknown>;
  organizeByType?: boolean;
  /** When true, missing originals are listed in manifest but do not abort. */
  allowPartial?: boolean;
};

export type XmlZipBuildResult = {
  ok: true;
  blob: Blob;
  manifest: Record<string, unknown>;
  exported: XmlZipEntry[];
  missingDocumentIds: string[];
} | {
  ok: false;
  reason: "no_xml_available" | "empty_selection";
  missingDocumentIds: string[];
  message: string;
};

/**
 * Build a ZIP of original XMLs only. Never reconstructs XML from normalized data.
 */
export async function buildSelectedXmlZip(input: XmlZipBuildInput): Promise<XmlZipBuildResult> {
  const { selectedDocuments, rawByDocumentId, store, filters, organizeByType, allowPartial } = input;
  if (!selectedDocuments.length) {
    return {
      ok: false,
      reason: "empty_selection",
      missingDocumentIds: [],
      message: "Nenhum documento selecionado.",
    };
  }

  const missingDocumentIds: string[] = [];
  const available: Array<{ doc: DocumentSummary; raw: RawXmlRecord }> = [];
  for (const doc of selectedDocuments) {
    const raw = rawByDocumentId.get(doc.id);
    if (!raw?.content) {
      missingDocumentIds.push(doc.id);
      continue;
    }
    available.push({ doc, raw });
  }

  if (!available.length) {
    return {
      ok: false,
      reason: "no_xml_available",
      missingDocumentIds,
      message:
        "XML original indisponível para a seleção. Reimporte o ZIP para preservar os XMLs locais (lotes antigos não possuem rawXml).",
    };
  }

  if (missingDocumentIds.length && !allowPartial) {
    // Caller should prompt; still return structured miss list via a soft-fail shape.
    // We proceed only when allowPartial is true.
  }

  if (missingDocumentIds.length && !allowPartial) {
    return {
      ok: false,
      reason: "no_xml_available",
      missingDocumentIds,
      message: `${missingDocumentIds.length} de ${selectedDocuments.length} documentos sem XML original. Confirme exportar apenas os disponíveis.`,
    };
  }

  const zip = new JSZip();
  const used = new Set<string>();
  const exported: XmlZipEntry[] = [];

  for (const { doc, raw } of available) {
    const baseName = sanitizeExportFileName(raw.fileName || doc.fileName || `${doc.id}.xml`);
    const folder =
      organizeByType && doc.documentType
        ? `${sanitizeExportFileName(doc.documentType)}/`
        : "";
    // Prevent Zip Slip: folder + name must stay relative without ".."
    const entryName = uniqueZipEntryName(`${folder}${baseName}`, used);
    if (entryName.includes("..") || entryName.startsWith("/")) {
      continue;
    }
    zip.file(entryName, raw.content);
    exported.push({
      documentId: doc.id,
      entryName,
      xmlHash: raw.xmlHash || doc.xmlHash || "",
      fileName: raw.fileName,
      byteLength: raw.byteLength,
    });
  }

  const genManifest = buildGenerationManifest({
    workspaceId: store.batch.workspaceId,
    batchIds: [store.batch.id],
    recordCounts: {
      requested: selectedDocuments.length,
      exported: exported.length,
      missing: missingDocumentIds.length,
    },
    filters: filters || {},
    sourceHashes: exported.map((e) => e.xmlHash).filter(Boolean),
  });

  const zipManifest = {
    version: "1.0.0",
    generation: genManifest,
    batch: {
      id: store.batch.id,
      name: store.batch.name,
    },
    generatedAt: new Date().toISOString(),
    filters: filters || {},
    documentIds: exported.map((e) => e.documentId),
    files: exported.map((e) => ({
      documentId: e.documentId,
      entryName: e.entryName,
      fileName: e.fileName,
      xmlHash: e.xmlHash,
      byteLength: e.byteLength,
    })),
    counts: {
      requested: selectedDocuments.length,
      exported: exported.length,
      missingOriginalXml: missingDocumentIds.length,
    },
    missingDocumentIds,
    parserVersion: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    disclaimer:
      "ZIP com XMLs originais preservados localmente. Não constitui arquivo oficial SEFAZ/PVA nem reconstrução a partir de JSON.",
  };

  zip.file("manifest.json", JSON.stringify(zipManifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return {
    ok: true,
    blob,
    manifest: zipManifest,
    exported,
    missingDocumentIds,
  };
}
