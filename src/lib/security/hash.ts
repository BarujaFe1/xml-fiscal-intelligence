/**
 * SHA-256 of XML content for duplicate detection.
 * Works in browser (SubtleCrypto) and Node (crypto).
 */
export async function sha256Hex(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node fallback
  const { createHash } = await import("crypto");
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function isValidCnpjFormat(doc?: string): boolean {
  if (!doc) return true;
  const d = doc.replace(/\D/g, "");
  return d.length === 14;
}

export function isValidCpfFormat(doc?: string): boolean {
  if (!doc) return true;
  const d = doc.replace(/\D/g, "");
  return d.length === 11;
}

export function isValidCnpjOrCpfFormat(doc?: string): boolean {
  if (!doc) return true;
  const d = doc.replace(/\D/g, "");
  return d.length === 11 || d.length === 14;
}
