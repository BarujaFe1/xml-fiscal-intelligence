import { IMPORT_LIMITS } from "@/lib/import/limits";

export type SafePathResult =
  | { ok: true; safeName: string; depth: number }
  | { ok: false; reason: string };

/**
 * Reject Zip Slip, absolute paths, UNC, null bytes, and excessive depth.
 */
export function sanitizeZipEntryPath(entryName: string): SafePathResult {
  if (!entryName || typeof entryName !== "string") {
    return { ok: false, reason: "empty_path" };
  }
  if (entryName.includes("\0")) {
    return { ok: false, reason: "null_byte" };
  }
  const unified = entryName.replace(/\\/g, "/");
  if (/^[a-zA-Z]:/.test(unified) || unified.startsWith("/") || unified.startsWith("//")) {
    return { ok: false, reason: "absolute_or_unc" };
  }
  const parts = unified.split("/").filter((p) => p.length > 0 && p !== ".");
  if (parts.some((p) => p === "..")) {
    return { ok: false, reason: "path_traversal" };
  }
  if (parts.length > IMPORT_LIMITS.maxPathDepth) {
    return { ok: false, reason: "path_too_deep" };
  }
  const safeName = parts[parts.length - 1] || "unnamed";
  const lower = safeName.toLowerCase();
  if (IMPORT_LIMITS.blockedExtensions.some((ext) => lower.endsWith(ext))) {
    return { ok: false, reason: "dangerous_extension" };
  }
  return { ok: true, safeName, depth: parts.length };
}

export function assertWithinImportBudget(input: {
  compressedBytes: number;
  uncompressedBytes: number;
  fileCount: number;
  singleFileBytes: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.compressedBytes > IMPORT_LIMITS.maxCompressedBytes) {
    return { ok: false, reason: "compressed_too_large" };
  }
  if (input.uncompressedBytes > IMPORT_LIMITS.maxUncompressedBytes) {
    return { ok: false, reason: "uncompressed_too_large" };
  }
  if (input.fileCount > IMPORT_LIMITS.maxFiles) {
    return { ok: false, reason: "too_many_files" };
  }
  if (input.singleFileBytes > IMPORT_LIMITS.maxSingleFileBytes) {
    return { ok: false, reason: "single_file_too_large" };
  }
  if (
    input.compressedBytes > 0 &&
    input.uncompressedBytes / input.compressedBytes > IMPORT_LIMITS.maxCompressionRatio
  ) {
    return { ok: false, reason: "compression_ratio" };
  }
  return { ok: true };
}
