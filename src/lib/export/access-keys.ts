import type { DocumentSummary } from "@/types";

export type AccessKeysTxtResult = {
  text: string;
  exportedKeys: number;
  withoutKey: number;
  duplicatesSkipped: number;
};

/**
 * One access key per line. Empty keys skipped. Duplicates removed by default.
 */
export function buildAccessKeysTxt(
  documents: DocumentSummary[],
  options?: { preserveDuplicates?: boolean },
): AccessKeysTxtResult {
  const preserveDuplicates = options?.preserveDuplicates ?? false;
  const lines: string[] = [];
  const seen = new Set<string>();
  let withoutKey = 0;
  let duplicatesSkipped = 0;

  for (const d of documents) {
    const key = (d.accessKey || "").trim();
    if (!key) {
      withoutKey += 1;
      continue;
    }
    if (!preserveDuplicates && seen.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(key);
    lines.push(key);
  }

  return {
    text: lines.join("\n") + (lines.length ? "\n" : ""),
    exportedKeys: lines.length,
    withoutKey,
    duplicatesSkipped,
  };
}
