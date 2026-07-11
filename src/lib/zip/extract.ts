import JSZip from "jszip";
import { IMPORT_LIMITS } from "@/lib/import/limits";
import { assertWithinImportBudget, sanitizeZipEntryPath } from "@/lib/import/zip-security";

export interface ExtractedXmlFile {
  path: string;
  fileName: string;
  content: string;
}

export interface ZipExtractionResult {
  totalFiles: number;
  xmlFiles: ExtractedXmlFile[];
  skipped: Array<{ path: string; reason: string }>;
}

function extensionOf(path: string) {
  const base = path.split("/").pop() || path;
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx).toLowerCase() : "";
}

/**
 * Safely extract XML files from a ZIP buffer.
 * Central limits: IMPORT_LIMITS + sanitizeZipEntryPath.
 */
export async function extractXmlFromZip(
  buffer: ArrayBuffer | Buffer,
  options?: { maxFiles?: number; maxXmlBytes?: number },
): Promise<ZipExtractionResult> {
  const maxFiles = options?.maxFiles ?? IMPORT_LIMITS.maxFiles;
  const maxXmlBytes = options?.maxXmlBytes ?? IMPORT_LIMITS.maxSingleFileBytes;
  const compressedBytes = buffer instanceof ArrayBuffer ? buffer.byteLength : buffer.length;

  const zip = await JSZip.loadAsync(buffer);
  const skipped: ZipExtractionResult["skipped"] = [];
  const xmlFiles: ExtractedXmlFile[] = [];
  let totalFiles = 0;
  let uncompressedEstimate = 0;

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    totalFiles += 1;
    const rawName = entry.name;
    const safe = sanitizeZipEntryPath(rawName);
    if (!safe.ok) {
      skipped.push({ path: rawName, reason: safe.reason });
      continue;
    }

    const ext = extensionOf(safe.safeName);
    if (ext !== ".xml") {
      skipped.push({ path: rawName, reason: ext ? "not_xml" : "not_xml" });
      continue;
    }

    if (xmlFiles.length >= maxFiles) {
      skipped.push({ path: rawName, reason: "max_files_exceeded" });
      continue;
    }

    const content = await entry.async("string");
    const bytes = Buffer.byteLength(content, "utf8");
    uncompressedEstimate += bytes;

    const budget = assertWithinImportBudget({
      compressedBytes,
      uncompressedBytes: uncompressedEstimate,
      fileCount: totalFiles,
      singleFileBytes: bytes,
    });
    if (!budget.ok) {
      skipped.push({ path: rawName, reason: budget.reason });
      continue;
    }

    if (bytes > maxXmlBytes) {
      skipped.push({ path: rawName, reason: "xml_too_large" });
      continue;
    }

    xmlFiles.push({ path: rawName.replace(/\\/g, "/"), fileName: safe.safeName, content });
  }

  return { totalFiles, xmlFiles, skipped };
}
