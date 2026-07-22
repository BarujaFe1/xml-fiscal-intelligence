/** SHA-256 hex — browser (Web Crypto) and Node. */
export async function sha256Hex(data: string | Uint8Array | ArrayBuffer): Promise<string> {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data;

  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", copy);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Node fallback without bundling node:crypto into client
  const { createHash } = await import("crypto");
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function formatSha256Sums(entries: Array<{ path: string; hash: string }>): string {
  return entries.map((e) => `${e.hash}  ${e.path}`).join("\n") + (entries.length ? "\n" : "");
}
