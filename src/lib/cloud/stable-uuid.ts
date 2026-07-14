/**
 * Map non-UUID local ids to deterministic UUIDs for Postgres uuid columns.
 */
import { createHash } from "crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** UUID v5-ish (SHA-1 name → RFC-like layout) for stable cloud keys. */
export function uuidFromLocalKey(namespace: string, localKey: string): string {
  if (isUuid(localKey)) return localKey.toLowerCase();
  const hash = createHash("sha1")
    .update(`${namespace}:${localKey}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
