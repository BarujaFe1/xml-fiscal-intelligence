import type { ExportDatasetV2 } from "@/lib/export/v2/types";

export type KeysTxtResult = {
  text: string;
  exportedKeys: number;
  withoutKey: number;
  duplicatesSkipped: number;
};

const KEY_RE = /^\d{44}$/;

/**
 * Pure access-key TXT: one 44-digit key per line, trailing newline, no header.
 * Uses keys already present on the dataset (privacy may have masked them —
 * for operational key lists use operational_full).
 */
export function buildKeysTxtFromDataset(
  dataset: ExportDatasetV2,
  options?: {
    dedupe?: boolean;
    sortByKey?: boolean;
    /** Prefer original unmasked keys from selection when available via this map */
    rawKeysByDocumentId?: Map<string, string>;
  },
): KeysTxtResult {
  const dedupe = options?.dedupe ?? true;
  const sortByKey = options?.sortByKey ?? false;
  const lines: string[] = [];
  const seen = new Set<string>();
  let withoutKey = 0;
  let duplicatesSkipped = 0;

  for (const d of dataset.documents) {
    const raw = options?.rawKeysByDocumentId?.get(d.id) || d.accessKey || "";
    const key = raw.trim();
    if (!key || !KEY_RE.test(key)) {
      withoutKey += 1;
      continue;
    }
    if (dedupe && seen.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(key);
    lines.push(key);
  }

  if (sortByKey) lines.sort();

  return {
    text: lines.join("\n") + (lines.length ? "\n" : ""),
    exportedKeys: lines.length,
    withoutKey,
    duplicatesSkipped,
  };
}
