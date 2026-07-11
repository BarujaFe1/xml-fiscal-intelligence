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

export {
  isValidCnpj as isValidCnpjFormat,
  isValidCpfFormat,
  isValidCnpjOrCpf as isValidCnpjOrCpfFormat,
} from "@/lib/fiscal/cnpj";
