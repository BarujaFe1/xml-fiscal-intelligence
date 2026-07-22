import { slugify } from "@/lib/utils";

function dateTimeStamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}${m}${day}-${hh}${mm}`;
}

function batchToken(batchNameOrId: string): string {
  const slug = slugify(batchNameOrId).slice(0, 40);
  return slug || "lote";
}

function shortId(generationId?: string): string {
  if (!generationId) return Math.random().toString(36).slice(2, 8);
  return generationId.replace(/-/g, "").slice(0, 8);
}

export type SelectionExportFileKind =
  | "xml-zip"
  | "xlsx"
  | "csv-docs"
  | "csv-items"
  | "csv-zip"
  | "json"
  | "jsonl"
  | "html"
  | "keys-txt"
  | "package";

export function selectionExportFilename(
  kind: SelectionExportFileKind,
  batchNameOrId: string,
  when = new Date(),
  generationId?: string,
): string {
  const lote = batchToken(batchNameOrId);
  const stamp = dateTimeStamp(when);
  const gid = shortId(generationId);
  switch (kind) {
    case "xml-zip":
      return `xml-selecionados-${lote}-${stamp}-${gid}.zip`;
    case "xlsx":
      return `notas-selecionadas-${lote}-${stamp}-${gid}.xlsx`;
    case "csv-docs":
      return `documentos-selecionados-${lote}-${stamp}-${gid}.csv`;
    case "csv-items":
      return `itens-selecionados-${lote}-${stamp}-${gid}.csv`;
    case "csv-zip":
      return `csv-selecionados-${lote}-${stamp}-${gid}.zip`;
    case "json":
      return `dados-selecionados-${lote}-${stamp}-${gid}.json`;
    case "jsonl":
      return `dados-selecionados-${lote}-${stamp}-${gid}.jsonl`;
    case "html":
      return `relatorio-selecionado-${lote}-${stamp}-${gid}.html`;
    case "keys-txt":
      return `chaves-selecionadas-${lote}-${stamp}-${gid}.txt`;
    case "package":
      return `exportacao-${lote}-${stamp}-${gid}.zip`;
  }
}

/** Sanitize a filename for ZIP entries — no path separators / traversal. */
export function sanitizeExportFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "arquivo.xml";
  const cleaned = base
    .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "_")
    .slice(0, 180);
  return cleaned || "arquivo.xml";
}

/**
 * Resolve ZIP entry collisions deterministically: name.xml, name__2.xml, …
 */
export function uniqueZipEntryName(desired: string, used: Set<string>): string {
  const safe = sanitizeExportFileName(desired);
  if (!used.has(safe.toLowerCase())) {
    used.add(safe.toLowerCase());
    return safe;
  }
  const dot = safe.lastIndexOf(".");
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  let n = 2;
  while (n < 10_000) {
    const candidate = `${stem}__${n}${ext}`;
    if (!used.has(candidate.toLowerCase())) {
      used.add(candidate.toLowerCase());
      return candidate;
    }
    n += 1;
  }
  const fallback = `${stem}__${Date.now()}${ext}`;
  used.add(fallback.toLowerCase());
  return fallback;
}
