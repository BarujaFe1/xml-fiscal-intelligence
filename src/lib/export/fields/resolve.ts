import { moneyAdd, moneyToFixed } from "@/lib/money/decimal";
import { sanitizeHumanText } from "@/lib/export/v2/text";
import type { ExportAggregation, ExportFieldDefinition } from "@/lib/export/fields/types";
import type { DocumentSummary } from "@/types";

function collectMatchingValues(
  flat: Record<string, string | number | boolean | null>,
  paths: string[],
  mode: "suffix" | "exact",
): string[] {
  const out: string[] = [];
  const seenKeys = new Set<string>();
  const entries = Object.entries(flat);
  for (const want of paths) {
    const wantNorm = want.replace(/\//g, ".").replace(/^\/+/, "");
    const matchedThisPath: string[] = [];
    for (const [k, v] of entries) {
      if (v === null || v === undefined || v === "") continue;
      if (seenKeys.has(k)) continue;
      const hit =
        mode === "exact"
          ? k === wantNorm || k.endsWith(`.${wantNorm}`) || k.replace(/\[\d+\]/g, "") === wantNorm
          : k === wantNorm ||
            k.endsWith(`.${wantNorm}`) ||
            k.replace(/\[\d+\]/g, "").endsWith(`.${wantNorm}`) ||
            k.replace(/\[\d+\]/g, "") === wantNorm ||
            (wantNorm.includes(".")
              ? false
              : k.split(".").pop() === wantNorm);
      if (hit) {
        seenKeys.add(k);
        matchedThisPath.push(String(v));
      }
    }
    out.push(...matchedThisPath);
    if (mode === "exact" && out.length) break;
  }
  return out;
}

function accessKeyFromDoc(doc: DocumentSummary): string {
  if (doc.accessKey && /^\d{44}$/.test(doc.accessKey)) return doc.accessKey;
  const id = String(doc.flattenedJson?.["infNFe.@_Id"] || doc.flattenedJson?.["@_Id"] || "");
  const m = id.match(/(\d{44})/);
  return m?.[1] || doc.accessKey || "";
}

/**
 * Resolve a field value for one document according to aggregation policy.
 */
export function resolveFieldValue(
  doc: DocumentSummary,
  def: ExportFieldDefinition,
  aggregation?: ExportAggregation,
): string {
  const agg = aggregation || def.defaultAggregation || "first";
  const flat = doc.flattenedJson || {};

  // Structured shortcuts for curated defaults
  switch (def.fieldId) {
    case "access_key":
      return accessKeyFromDoc(doc);
    case "document_number":
      return doc.number || String(flat["ide.nNF"] ?? flat["nNF"] ?? "");
    case "emitter_cpf":
      return pickPartyDoc(flat, doc.emitterDoc, "cpf", "emit");
    case "emitter_cnpj":
      return pickPartyDoc(flat, doc.emitterDoc, "cnpj", "emit");
    case "receiver_cpf":
      return pickPartyDoc(flat, doc.receiverDoc, "cpf", "dest");
    case "receiver_cnpj":
      return pickPartyDoc(flat, doc.receiverDoc, "cnpj", "dest");
    case "emitter_name":
      return sanitizeHumanText(doc.emitterName || flat["emit.xNome"] || "");
    case "receiver_name":
      return sanitizeHumanText(doc.receiverName || flat["dest.xNome"] || "");
    case "issue_datetime":
      return doc.issueDate || String(flat["ide.dhEmi"] ?? flat["ide.dEmi"] ?? "");
    default:
      break;
  }

  const mode = agg === "first_exact_path" ? "exact" : "suffix";
  let values = collectMatchingValues(flat, def.xmlPaths, mode);

  // Prefer emit/dest scoped paths for party fields discovered from inventory
  if (def.scope === "emitente" || def.scope === "emitter") {
    values = values.filter((_) => true);
    const scoped = collectMatchingValues(
      flat,
      def.xmlPaths.map((p) => (p.includes("emit") ? p : `emit.${p}`)),
      mode,
    );
    if (scoped.length) values = scoped;
  }
  if (def.scope === "destinatario" || def.scope === "receiver") {
    const scoped = collectMatchingValues(
      flat,
      def.xmlPaths.map((p) => (p.includes("dest") ? p : `dest.${p}`)),
      mode,
    );
    if (scoped.length) values = scoped;
  }

  if (!values.length) return "";

  switch (agg) {
    case "decimal_sum": {
      const total = moneyToFixed(moneyAdd(...values), 2);
      return total;
    }
    case "decimal_min":
      return moneyToFixed(
        values.reduce((a, b) => (moneyToFixed(a, 6) < moneyToFixed(b, 6) ? a : b)),
        2,
      );
    case "decimal_max":
      return moneyToFixed(
        values.reduce((a, b) => (moneyToFixed(a, 6) > moneyToFixed(b, 6) ? a : b)),
        2,
      );
    case "distinct_list": {
      const uniq = [...new Set(values.map((v) => sanitizeHumanText(v)))].sort();
      return uniq.join(" | ");
    }
    case "ordered_list":
      return values.map((v) => sanitizeHumanText(v)).join(" | ");
    case "count":
      return String(values.length);
    case "last":
      return sanitizeHumanText(values[values.length - 1] || "");
    case "first_non_empty":
    case "first_exact_path":
    case "first":
    default:
      return sanitizeHumanText(values[0] || "");
  }
}

function pickPartyDoc(
  flat: Record<string, string | number | boolean | null>,
  summaryDoc: string | undefined,
  kind: "cpf" | "cnpj",
  party: "emit" | "dest",
): string {
  const key = kind === "cpf" ? `${party}.CPF` : `${party}.CNPJ`;
  const fromFlat = flat[key];
  if (fromFlat !== undefined && fromFlat !== null && fromFlat !== "") return String(fromFlat);
  if (!summaryDoc) return "";
  const digits = summaryDoc.replace(/\D/g, "");
  if (kind === "cpf" && digits.length === 11) return summaryDoc;
  if (kind === "cnpj" && (digits.length === 14 || /[A-Za-z]/.test(summaryDoc))) return summaryDoc;
  return "";
}

export function buildSelectedRow(
  doc: DocumentSummary,
  defs: ExportFieldDefinition[],
  aggregations?: Record<string, ExportAggregation>,
  extra?: Record<string, string>,
): Record<string, string> {
  const row: Record<string, string> = { ...(extra || {}) };
  for (const def of defs) {
    row[def.fieldId] = resolveFieldValue(doc, def, aggregations?.[def.fieldId]);
  }
  return row;
}

/** Long-form occurrences from flattenedJson for "Todos os Campos". */
export function* iterateFieldOccurrences(
  doc: DocumentSummary,
  batchMeta: { batchId: string; batchName?: string },
  registryByPath: Map<string, ExportFieldDefinition>,
): Generator<{
  batchId: string;
  batchName?: string;
  documentId: string;
  accessKey?: string;
  number?: string;
  scope: string;
  occurrenceIndex?: number;
  xmlPath: string;
  tag: string;
  humanLabel: string;
  dataType: string;
  value: string;
}> {
  const flat = doc.flattenedJson || {};
  for (const [xmlPath, raw] of Object.entries(flat)) {
    const tag = xmlPath.split(".").pop() || xmlPath;
    const def = registryByPath.get(xmlPath);
    const occMatch = xmlPath.match(/\[(\d+)\]/g);
    const occurrenceIndex = occMatch
      ? Number(occMatch[occMatch.length - 1]!.replace(/\D/g, ""))
      : undefined;
    yield {
      batchId: batchMeta.batchId,
      batchName: batchMeta.batchName,
      documentId: doc.id,
      accessKey: doc.accessKey,
      number: doc.number,
      scope: def?.scope || "other",
      occurrenceIndex,
      xmlPath,
      tag,
      humanLabel: def?.humanLabelPtBr || tag,
      dataType: def?.dataType || typeof raw,
      value: raw === null || raw === undefined ? "" : String(raw),
    };
  }
}
