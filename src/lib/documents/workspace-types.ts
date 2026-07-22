import type { DocFilterState } from "@/lib/analytics";
import { emptyDocFilters } from "@/lib/analytics";

/**
 * Faceted multi-select filters (OR within facet, AND between facets).
 * Free-text draft lives separately and must not update URL per keystroke.
 */
export type AppliedFacetFilters = {
  batchIds: string[];
  emitterIds: string[];
  receiverIds: string[];
  documentTypes: string[];
  models: string[];
  statuses: string[];
  ufOrigin: string[];
  ufDest: string[];
  natures: string[];
  classifications: string[];
  cfops: string[];
  ncms: string[];
  cClassTribs: string[];
  parseStatuses: string[];
  /** CBS: gt0 | zero | absent (never treat absent as zero). */
  cbsPresence: string[];
  /** IBS: gt0 | zero | absent */
  ibsPresence: string[];
};

export type FilterDraft = {
  partySearch: string;
  freeText: string;
  number: string;
  series: string;
  accessKey: string;
  dateFrom: string;
  dateTo: string;
  minValue: string;
  maxValue: string;
};

export type DocumentWorkspaceScope =
  | { mode: "single_batch"; batchIds: [string] }
  | { mode: "multi_batch"; batchIds: string[] };

export function emptyAppliedFacets(): AppliedFacetFilters {
  return {
    batchIds: [],
    emitterIds: [],
    receiverIds: [],
    documentTypes: [],
    models: [],
    statuses: [],
    ufOrigin: [],
    ufDest: [],
    natures: [],
    classifications: [],
    cfops: [],
    ncms: [],
    cClassTribs: [],
    parseStatuses: [],
    cbsPresence: [],
    ibsPresence: [],
  };
}

export function emptyFilterDraft(): FilterDraft {
  return {
    partySearch: "",
    freeText: "",
    number: "",
    series: "",
    accessKey: "",
    dateFrom: "",
    dateTo: "",
    minValue: "",
    maxValue: "",
  };
}

/** Merge applied facets + committed free fields into legacy DocFilterState for reuse. */
export function toDocFilterState(
  facets: AppliedFacetFilters,
  committed: Partial<FilterDraft>,
): DocFilterState {
  const base = emptyDocFilters();
  return {
    ...base,
    q: committed.freeText || "",
    number: committed.number || "",
    series: committed.series || "",
    accessKey: committed.accessKey || "",
    dateFrom: committed.dateFrom || "",
    dateTo: committed.dateTo || "",
    minValue: committed.minValue || "",
    maxValue: committed.maxValue || "",
    // Single-value legacy bridges (first selected) — full multi handled in filterDocumentsMulti
    type: facets.documentTypes.length === 1 ? facets.documentTypes[0]! : "ALL",
    model: facets.models[0] || "",
    status: facets.statuses[0] || "",
    ufOrigin: facets.ufOrigin[0] || "",
    ufDest: facets.ufDest[0] || "",
    nature: facets.natures[0] || "",
    classification: facets.classifications[0] || "",
    cfop: facets.cfops[0] || "",
    ncm: facets.ncms[0] || "",
    parse: (facets.parseStatuses[0] as DocFilterState["parse"]) || "ALL",
  };
}

export function encodeFacetParam(values: string[]): string {
  return values.map(encodeURIComponent).join(",");
}

export function decodeFacetParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean);
}

export function facetsFromSearchParams(params: URLSearchParams): AppliedFacetFilters {
  const f = emptyAppliedFacets();
  f.batchIds = decodeFacetParam(params.get("batches"));
  f.emitterIds = decodeFacetParam(params.get("emitters"));
  f.receiverIds = decodeFacetParam(params.get("receivers"));
  f.documentTypes = decodeFacetParam(params.get("types"));
  f.models = decodeFacetParam(params.get("models"));
  f.statuses = decodeFacetParam(params.get("statuses"));
  f.ufOrigin = decodeFacetParam(params.get("ufOrigin"));
  f.ufDest = decodeFacetParam(params.get("ufDest"));
  f.natures = decodeFacetParam(params.get("natures"));
  f.classifications = decodeFacetParam(params.get("classifications"));
  f.cfops = decodeFacetParam(params.get("cfops"));
  f.ncms = decodeFacetParam(params.get("ncms"));
  f.cClassTribs = decodeFacetParam(params.get("cClassTribs"));
  f.parseStatuses = decodeFacetParam(params.get("parse"));
  f.cbsPresence = decodeFacetParam(params.get("cbs"));
  f.ibsPresence = decodeFacetParam(params.get("ibs"));
  // Legacy single receiver/emitter doc params
  const legacyReceiver = params.get("receiverDoc");
  if (legacyReceiver && !f.receiverIds.length) {
    f.receiverIds = [`UNKNOWN:${legacyReceiver.replace(/\W/g, "").toUpperCase()}`];
  }
  return f;
}

export function facetsToSearchParams(facets: AppliedFacetFilters): URLSearchParams {
  const p = new URLSearchParams();
  const set = (key: string, values: string[]) => {
    if (values.length) p.set(key, encodeFacetParam(values));
  };
  set("batches", facets.batchIds);
  set("emitters", facets.emitterIds);
  set("receivers", facets.receiverIds);
  set("types", facets.documentTypes);
  set("models", facets.models);
  set("statuses", facets.statuses);
  set("ufOrigin", facets.ufOrigin);
  set("ufDest", facets.ufDest);
  set("natures", facets.natures);
  set("classifications", facets.classifications);
  set("cfops", facets.cfops);
  set("ncms", facets.ncms);
  set("cClassTribs", facets.cClassTribs);
  set("parse", facets.parseStatuses);
  set("cbs", facets.cbsPresence);
  set("ibs", facets.ibsPresence);
  return p;
}

export type WorkspaceDocument = {
  /** Composite stable id: batchId:documentId */
  selectionId: string;
  batchId: string;
  batchName: string;
  competence?: string;
  origin: "local" | "cloud";
  importedAt?: string;
  document: import("@/types").DocumentSummary;
};

export function selectionId(batchId: string, documentId: string): string {
  return `${batchId}:${documentId}`;
}

export function parseSelectionId(id: string): { batchId: string; documentId: string } {
  const i = id.indexOf(":");
  if (i < 0) return { batchId: "", documentId: id };
  return { batchId: id.slice(0, i), documentId: id.slice(i + 1) };
}
