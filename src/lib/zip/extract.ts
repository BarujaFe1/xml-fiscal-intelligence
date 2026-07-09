import JSZip from "jszip";

const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".js",
  ".msi",
  ".dll",
  ".com",
  ".scr",
  ".vbs",
]);

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

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function isZipSlip(path: string) {
  const normalized = normalizeZipPath(path);
  if (normalized.includes("..")) return true;
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return true;
  return false;
}

function extensionOf(path: string) {
  const base = path.split("/").pop() || path;
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx).toLowerCase() : "";
}

/**
 * Safely extract XML files from a ZIP buffer.
 * - Blocks zip slip
 * - Ignores dangerous extensions
 * - Never executes archive contents
 */
export async function extractXmlFromZip(
  buffer: ArrayBuffer | Buffer,
  options?: { maxFiles?: number; maxXmlBytes?: number },
): Promise<ZipExtractionResult> {
  const maxFiles = options?.maxFiles ?? 5000;
  const maxXmlBytes = options?.maxXmlBytes ?? 5 * 1024 * 1024;

  const zip = await JSZip.loadAsync(buffer);
  const skipped: ZipExtractionResult["skipped"] = [];
  const xmlFiles: ExtractedXmlFile[] = [];
  let totalFiles = 0;

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    totalFiles += 1;
    // Prefer original name when available (JSZip may normalize ../ away)
    const rawName = (entry as { name: string; unsafeOriginalName?: string }).name;
    const path = normalizeZipPath(rawName);

    if (isZipSlip(path) || rawName.includes("..") || rawName.includes("\\")) {
      skipped.push({ path: rawName, reason: "zip_slip_blocked" });
      continue;
    }

    const ext = extensionOf(path);
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      skipped.push({ path, reason: "dangerous_extension" });
      continue;
    }

    if (ext !== ".xml") {
      skipped.push({ path, reason: "not_xml" });
      continue;
    }

    if (xmlFiles.length >= maxFiles) {
      skipped.push({ path, reason: "max_files_exceeded" });
      continue;
    }

    const content = await entry.async("string");
    if (Buffer.byteLength(content, "utf8") > maxXmlBytes) {
      skipped.push({ path, reason: "xml_too_large" });
      continue;
    }

    const fileName = path.split("/").pop() || path;
    xmlFiles.push({ path, fileName, content });
  }

  return { totalFiles, xmlFiles, skipped };
}
