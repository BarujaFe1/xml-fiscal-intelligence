import type { BatchStore, DocumentSummary } from "@/types";
import { moneyAdd, moneyToFixed } from "@/lib/money/decimal";
import { detectDocumentRtcLabels } from "@/lib/documents/rtc-labels";

export type FacetOption = {
  id: string;
  label: string;
  count: number;
  totalValue?: string;
  meta?: Record<string, string>;
};

export type PartyFacetOption = FacetOption & {
  docKind: "CNPJ" | "CPF" | "UNKNOWN";
  normalizedDoc: string;
  incomplete?: boolean;
};

export type FacetIndex = {
  builtAt: string;
  documentCount: number;
  batches: FacetOption[];
  emitters: PartyFacetOption[];
  receivers: PartyFacetOption[];
  documentTypes: FacetOption[];
  models: FacetOption[];
  statuses: FacetOption[];
  ufOrigin: FacetOption[];
  ufDest: FacetOption[];
  natures: FacetOption[];
  classifications: FacetOption[];
  cfops: FacetOption[];
  ncms: FacetOption[];
  cClassTribs: FacetOption[];
  parseStatuses: FacetOption[];
};

function partyId(kind: string, doc: string, name: string): string {
  const norm = doc.replace(/\W/g, "").toUpperCase();
  if (norm) return `${kind}:${norm}`;
  return `${kind}:name:${name.trim().toLowerCase() || "sem-documento"}`;
}

function bump(
  map: Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd>; meta?: Record<string, string> }>,
  id: string,
  label: string,
  value: number | undefined,
  meta?: Record<string, string>,
) {
  const cur = map.get(id) || { label, count: 0, total: moneyAdd(0), meta };
  cur.count += 1;
  cur.total = moneyAdd(cur.total, value ?? 0);
  map.set(id, cur);
}

function toOptions(
  map: Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd>; meta?: Record<string, string> }>,
): FacetOption[] {
  return [...map.entries()]
    .map(([id, v]) => ({
      id,
      label: v.label,
      count: v.count,
      totalValue: moneyToFixed(v.total, 2),
      meta: v.meta,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

function toPartyOptions(
  map: Map<
    string,
    {
      label: string;
      count: number;
      total: ReturnType<typeof moneyAdd>;
      meta?: Record<string, string>;
      docKind: PartyFacetOption["docKind"];
      normalizedDoc: string;
      incomplete?: boolean;
    }
  >,
): PartyFacetOption[] {
  return [...map.entries()]
    .map(([id, v]) => ({
      id,
      label: v.label,
      count: v.count,
      totalValue: moneyToFixed(v.total, 2),
      meta: v.meta,
      docKind: v.docKind,
      normalizedDoc: v.normalizedDoc,
      incomplete: v.incomplete,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

/**
 * Build facet options once per store snapshot. Pure — does not mutate stores.
 */
export function buildFacetIndex(
  stores: BatchStore[],
  options?: { workspaceId?: string },
): FacetIndex {
  const workspaceId = options?.workspaceId;
  const batches = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd>; meta?: Record<string, string> }>();
  const emitters = new Map<
    string,
    {
      label: string;
      count: number;
      total: ReturnType<typeof moneyAdd>;
      meta?: Record<string, string>;
      docKind: PartyFacetOption["docKind"];
      normalizedDoc: string;
      incomplete?: boolean;
    }
  >();
  const receivers = new Map<typeof emitters extends Map<infer K, infer V> ? K : never, typeof emitters extends Map<string, infer V> ? V : never>();
  const documentTypes = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const models = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const statuses = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const ufOrigin = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const ufDest = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const natures = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const classifications = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const cfops = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const ncms = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const cClassTribs = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();
  const parseStatuses = new Map<string, { label: string; count: number; total: ReturnType<typeof moneyAdd> }>();

  let documentCount = 0;

  for (const store of stores) {
    if (workspaceId && store.batch.workspaceId !== workspaceId) continue;
    const batchLabel = store.batch.name || store.batch.id;
    const competence =
      store.batch.month && store.batch.year
        ? `${String(store.batch.month).padStart(2, "0")}/${store.batch.year}`
        : "";

    const itemsByDoc = new Map<string, typeof store.items>();
    for (const item of store.items) {
      const list = itemsByDoc.get(item.documentId) || [];
      list.push(item);
      itemsByDoc.set(item.documentId, list);
    }

    for (const d of store.documents) {
      documentCount += 1;
      bump(batches, store.batch.id, batchLabel, d.totalValue, {
        competence,
        origin: store.batch.syncStatus === "synced" ? "cloud" : "local",
      });

      addParty(emitters, d, "emit");
      addParty(receivers as typeof emitters, d, "dest");

      bump(documentTypes, d.documentType, d.documentType, d.totalValue);
      if (d.model) bump(models, d.model, d.model, d.totalValue);
      if (d.status) bump(statuses, d.status, d.status, d.totalValue);
      if (d.emitterUf) bump(ufOrigin, d.emitterUf, d.emitterUf, d.totalValue);
      if (d.receiverUf) bump(ufDest, d.receiverUf, d.receiverUf, d.totalValue);
      if (d.natureOperation) bump(natures, d.natureOperation, d.natureOperation, d.totalValue);
      if (d.operationClassification) {
        bump(classifications, d.operationClassification, d.operationClassification, d.totalValue);
      }
      bump(parseStatuses, d.parseStatus, d.parseStatus, d.totalValue);

      const items = itemsByDoc.get(d.id) || [];
      for (const item of items) {
        if (item.cfop) bump(cfops, item.cfop, item.cfop, item.totalValue);
        if (item.ncm) bump(ncms, item.ncm, item.ncm, item.totalValue);
      }

      // cClassTrib from flatten
      for (const [k, v] of Object.entries(d.flattenedJson || {})) {
        if (!/cClassTrib$/i.test(k) || v === null || v === undefined || v === "") continue;
        const code = String(v);
        bump(cClassTribs, code, code, undefined);
      }

      // Ensure RTC detection does not invent amounts — facets only need presence path keys
      detectDocumentRtcLabels(d, items);
    }
  }

  return {
    builtAt: new Date().toISOString(),
    documentCount,
    batches: toOptions(batches),
    emitters: toPartyOptions(emitters),
    receivers: toPartyOptions(receivers as typeof emitters),
    documentTypes: toOptions(documentTypes),
    models: toOptions(models),
    statuses: toOptions(statuses),
    ufOrigin: toOptions(ufOrigin),
    ufDest: toOptions(ufDest),
    natures: toOptions(natures),
    classifications: toOptions(classifications),
    cfops: toOptions(cfops),
    ncms: toOptions(ncms),
    cClassTribs: toOptions(cClassTribs),
    parseStatuses: toOptions(parseStatuses),
  };
}

function addParty(
  map: Map<
    string,
    {
      label: string;
      count: number;
      total: ReturnType<typeof moneyAdd>;
      meta?: Record<string, string>;
      docKind: PartyFacetOption["docKind"];
      normalizedDoc: string;
      incomplete?: boolean;
    }
  >,
  d: DocumentSummary,
  side: "emit" | "dest",
) {
  const doc = side === "emit" ? d.emitterDoc : d.receiverDoc;
  const name = side === "emit" ? d.emitterName : d.receiverName;
  const norm = (doc || "").replace(/\W/g, "").toUpperCase();
  let docKind: PartyFacetOption["docKind"] = "UNKNOWN";
  if (norm.length === 11) docKind = "CPF";
  else if (norm.length === 14 || /[A-Z]/.test(norm)) docKind = "CNPJ";
  const id = partyId(docKind, norm, name || "");
  const label = name
    ? `${name}${doc ? ` · ${doc}` : ""}`
    : doc || "(sem identificação)";
  const cur = map.get(id) || {
    label,
    count: 0,
    total: moneyAdd(0),
    docKind,
    normalizedDoc: norm,
    incomplete: !norm,
  };
  cur.count += 1;
  cur.total = moneyAdd(cur.total, d.totalValue ?? 0);
  map.set(id, cur);
}

/** Filter party options by local search text (does not touch applied filters). */
export function filterPartyOptions(
  options: PartyFacetOption[],
  query: string,
): PartyFacetOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const qDigits = q.replace(/\D/g, "");
  return options.filter((o) => {
    if (o.label.toLowerCase().includes(q)) return true;
    if (qDigits && o.normalizedDoc.includes(qDigits.toUpperCase())) return true;
    return o.id.toLowerCase().includes(q);
  });
}
