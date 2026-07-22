import type { BatchStore, DocumentItem, DocumentSummary } from "@/types";
import { cnpjIncludes } from "@/lib/fiscal/cnpj";
import { detectDocumentRtcLabels } from "@/lib/documents/rtc-labels";

export type DocFilterState = {
  q: string;
  type: string;
  uf: string;
  emitter: string;
  receiver: string;
  cfop: string;
  ncm: string;
  parse: string;
  alert: string;
  minValue: string;
  maxValue: string;
  /** Inclusive emission start (YYYY-MM-DD). */
  dateFrom: string;
  /** Inclusive emission end (YYYY-MM-DD). */
  dateTo: string;
  number: string;
  series: string;
  model: string;
  accessKey: string;
  emitterDoc: string;
  receiverDoc: string;
  ufOrigin: string;
  ufDest: string;
  nature: string;
  classification: string;
  status: string;
  protocol: string; // "with" | "without" | ""
  duplicate: string; // "normal" | "duplicate" | "possible" | ""
  qualityMin: string;
  qualityMax: string;
  /** Etiqueta CBS (vCBS / SOMA CBS / gCBS / IBSCBS…): "with" | "without" | "" */
  cbs: string;
  /** Etiqueta IBS (vIBS / SOMA IBS / gIBS…): "with" | "without" | "" */
  ibs: string;
};

export const emptyDocFilters = (): DocFilterState => ({
  q: "",
  type: "ALL",
  uf: "",
  emitter: "",
  receiver: "",
  cfop: "",
  ncm: "",
  parse: "",
  alert: "",
  minValue: "",
  maxValue: "",
  dateFrom: "",
  dateTo: "",
  number: "",
  series: "",
  model: "",
  accessKey: "",
  emitterDoc: "",
  receiverDoc: "",
  ufOrigin: "",
  ufDest: "",
  nature: "",
  classification: "",
  status: "",
  protocol: "",
  duplicate: "",
  qualityMin: "",
  qualityMax: "",
  cbs: "",
  ibs: "",
});

export function filtersFromSearchParams(sp: URLSearchParams): DocFilterState {
  return {
    q: sp.get("q") || "",
    type: sp.get("type") || "ALL",
    uf: sp.get("uf") || "",
    emitter: sp.get("emitter") || "",
    receiver: sp.get("receiver") || "",
    cfop: sp.get("cfop") || "",
    ncm: sp.get("ncm") || "",
    parse: sp.get("parse") || "",
    alert: sp.get("alert") || "",
    minValue: sp.get("min") || "",
    maxValue: sp.get("max") || "",
    dateFrom: sp.get("from") || "",
    dateTo: sp.get("to") || "",
    number: sp.get("number") || "",
    series: sp.get("series") || "",
    model: sp.get("model") || "",
    accessKey: sp.get("key") || "",
    emitterDoc: sp.get("emitterDoc") || "",
    receiverDoc: sp.get("receiverDoc") || "",
    ufOrigin: sp.get("ufOrigin") || "",
    ufDest: sp.get("ufDest") || "",
    nature: sp.get("nature") || "",
    classification: sp.get("class") || "",
    status: sp.get("status") || "",
    protocol: sp.get("protocol") || "",
    duplicate: sp.get("dup") || "",
    qualityMin: sp.get("qmin") || "",
    qualityMax: sp.get("qmax") || "",
    cbs: sp.get("cbs") || "",
    ibs: sp.get("ibs") || "",
  };
}

export function filtersToSearchParams(f: DocFilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.type && f.type !== "ALL") sp.set("type", f.type);
  if (f.uf) sp.set("uf", f.uf);
  if (f.emitter) sp.set("emitter", f.emitter);
  if (f.receiver) sp.set("receiver", f.receiver);
  if (f.cfop) sp.set("cfop", f.cfop);
  if (f.ncm) sp.set("ncm", f.ncm);
  if (f.parse) sp.set("parse", f.parse);
  if (f.alert) sp.set("alert", f.alert);
  if (f.minValue) sp.set("min", f.minValue);
  if (f.maxValue) sp.set("max", f.maxValue);
  if (f.dateFrom) sp.set("from", f.dateFrom);
  if (f.dateTo) sp.set("to", f.dateTo);
  if (f.number) sp.set("number", f.number);
  if (f.series) sp.set("series", f.series);
  if (f.model) sp.set("model", f.model);
  if (f.accessKey) sp.set("key", f.accessKey);
  if (f.emitterDoc) sp.set("emitterDoc", f.emitterDoc);
  if (f.receiverDoc) sp.set("receiverDoc", f.receiverDoc);
  if (f.ufOrigin) sp.set("ufOrigin", f.ufOrigin);
  if (f.ufDest) sp.set("ufDest", f.ufDest);
  if (f.nature) sp.set("nature", f.nature);
  if (f.classification) sp.set("class", f.classification);
  if (f.status) sp.set("status", f.status);
  if (f.protocol) sp.set("protocol", f.protocol);
  if (f.duplicate) sp.set("dup", f.duplicate);
  if (f.qualityMin) sp.set("qmin", f.qualityMin);
  if (f.qualityMax) sp.set("qmax", f.qualityMax);
  if (f.cbs) sp.set("cbs", f.cbs);
  if (f.ibs) sp.set("ibs", f.ibs);
  return sp;
}

export function countActiveFilters(f: DocFilterState) {
  let n = 0;
  if (f.q) n++;
  if (f.type && f.type !== "ALL") n++;
  if (f.uf) n++;
  if (f.emitter) n++;
  if (f.receiver) n++;
  if (f.cfop) n++;
  if (f.ncm) n++;
  if (f.parse) n++;
  if (f.alert) n++;
  if (f.minValue) n++;
  if (f.maxValue) n++;
  if (f.dateFrom) n++;
  if (f.dateTo) n++;
  if (f.number) n++;
  if (f.series) n++;
  if (f.model) n++;
  if (f.accessKey) n++;
  if (f.emitterDoc) n++;
  if (f.receiverDoc) n++;
  if (f.ufOrigin) n++;
  if (f.ufDest) n++;
  if (f.nature) n++;
  if (f.classification) n++;
  if (f.status) n++;
  if (f.protocol) n++;
  if (f.duplicate) n++;
  if (f.qualityMin) n++;
  if (f.qualityMax) n++;
  if (f.cbs) n++;
  if (f.ibs) n++;
  return n;
}

/** Active filter entries for removable chips (excludes empty / ALL). */
export function activeFilterEntries(f: DocFilterState): Array<{ key: keyof DocFilterState; label: string; value: string }> {
  const labels: Partial<Record<keyof DocFilterState, string>> = {
    q: "Busca",
    type: "Tipo",
    uf: "UF",
    emitter: "Emitente",
    receiver: "Destinatário",
    cfop: "CFOP",
    ncm: "NCM",
    parse: "Parse",
    alert: "Alerta",
    minValue: "Valor mín.",
    maxValue: "Valor máx.",
    dateFrom: "De",
    dateTo: "Até",
    number: "Número",
    series: "Série",
    model: "Modelo",
    accessKey: "Chave",
    emitterDoc: "CNPJ/CPF emit.",
    receiverDoc: "CNPJ/CPF dest.",
    ufOrigin: "UF origem",
    ufDest: "UF destino",
    nature: "Natureza",
    classification: "Classificação",
    status: "Situação",
    protocol: "Protocolo",
    duplicate: "Duplicidade",
    qualityMin: "Score mín.",
    qualityMax: "Score máx.",
    cbs: "CBS",
    ibs: "IBS",
  };
  const out: Array<{ key: keyof DocFilterState; label: string; value: string }> = [];
  for (const [key, value] of Object.entries(f) as Array<[keyof DocFilterState, string]>) {
    if (!value || (key === "type" && value === "ALL")) continue;
    let display = value;
    if ((key === "cbs" || key === "ibs") && value === "with") display = "com etiqueta";
    if ((key === "cbs" || key === "ibs") && value === "without") display = "sem etiqueta";
    out.push({ key, label: labels[key] || key, value: display });
  }
  return out;
}

function dayKey(iso?: string | null): string | null {
  if (!iso) return null;
  // Prefer calendar date portion for inclusive range without timezone surprises.
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildItemsByDoc(store: BatchStore): Map<string, DocumentItem[]> {
  const map = new Map<string, DocumentItem[]>();
  for (const item of store.items) {
    const list = map.get(item.documentId);
    if (list) list.push(item);
    else map.set(item.documentId, [item]);
  }
  return map;
}

export function sumDocumentValues(docs: DocumentSummary[]): number {
  return docs.reduce((acc, d) => acc + (d.totalValue || 0), 0);
}

export function filterDocuments(store: BatchStore, f: DocFilterState): DocumentSummary[] {
  const min = f.minValue ? Number(f.minValue) : undefined;
  const max = f.maxValue ? Number(f.maxValue) : undefined;
  const qMin = f.qualityMin ? Number(f.qualityMin) : undefined;
  const qMax = f.qualityMax ? Number(f.qualityMax) : undefined;
  const q = f.q.trim().toLowerCase();
  const itemsByDoc = buildItemsByDoc(store);
  const needsRtc =
    !!f.cbs ||
    !!f.ibs ||
    f.alert === "HAS_CBS" ||
    f.alert === "NO_CBS" ||
    f.alert === "HAS_IBS" ||
    f.alert === "NO_IBS";
  const rtcByDoc = new Map<string, ReturnType<typeof detectDocumentRtcLabels>>();
  if (needsRtc) {
    for (const d of store.documents) {
      rtcByDoc.set(d.id, detectDocumentRtcLabels(d, itemsByDoc.get(d.id)));
    }
  }

  // Duplicate keys set
  const keyCount = new Map<string, number>();
  for (const d of store.documents) {
    if (!d.accessKey) continue;
    keyCount.set(d.accessKey, (keyCount.get(d.accessKey) || 0) + 1);
  }

  // Possible duplicates via relationships
  const possibleDupIds = new Set<string>();
  for (const rel of store.relationships || []) {
    if (rel.relationshipType === "possible_duplicate") {
      possibleDupIds.add(rel.sourceDocumentId);
      possibleDupIds.add(rel.targetDocumentId);
    }
  }

  return store.documents.filter((d) => {
    if (f.type !== "ALL" && d.documentType !== f.type) return false;
    if (f.parse && d.parseStatus !== f.parse) return false;
    if (f.uf && d.emitterUf !== f.uf && d.receiverUf !== f.uf) return false;
    if (f.ufOrigin && d.emitterUf !== f.ufOrigin) return false;
    if (f.ufDest && d.receiverUf !== f.ufDest) return false;
    if (f.number && !(d.number || "").includes(f.number.trim())) return false;
    if (f.series && (d.series || "") !== f.series.trim()) return false;
    if (f.model && (d.model || "") !== f.model.trim()) return false;
    if (f.accessKey) {
      const needle = f.accessKey.trim().toLowerCase();
      if (!(d.accessKey || "").toLowerCase().includes(needle)) return false;
    }
    if (f.status) {
      const needle = f.status.trim().toLowerCase();
      if (!(d.status || "").toLowerCase().includes(needle)) return false;
    }
    if (f.nature) {
      const needle = f.nature.trim().toLowerCase();
      if (!(d.natureOperation || "").toLowerCase().includes(needle)) return false;
    }
    if (f.classification && d.operationClassification !== f.classification) return false;

    if (f.protocol === "with" && !d.protocol) return false;
    if (f.protocol === "without" && d.protocol) return false;

    if (f.cbs || f.ibs || f.alert === "HAS_CBS" || f.alert === "NO_CBS" || f.alert === "HAS_IBS" || f.alert === "NO_IBS") {
      const rtc = rtcByDoc.get(d.id) || detectDocumentRtcLabels(d, itemsByDoc.get(d.id));
      if (f.cbs === "with" && !rtc.hasCbs) return false;
      if (f.cbs === "without" && rtc.hasCbs) return false;
      if (f.ibs === "with" && !rtc.hasIbs) return false;
      if (f.ibs === "without" && rtc.hasIbs) return false;
      if (f.alert === "HAS_CBS" && !rtc.hasCbs) return false;
      if (f.alert === "NO_CBS" && rtc.hasCbs) return false;
      if (f.alert === "HAS_IBS" && !rtc.hasIbs) return false;
      if (f.alert === "NO_IBS" && rtc.hasIbs) return false;
    }

    if (f.duplicate === "normal" && d.isDuplicate) return false;
    if (f.duplicate === "duplicate" && !d.isDuplicate) return false;
    if (f.duplicate === "possible" && !possibleDupIds.has(d.id) && !d.isDuplicate) return false;

    if (f.emitter) {
      const needle = f.emitter.toLowerCase();
      const hit =
        cnpjIncludes(d.emitterDoc, f.emitter) ||
        d.emitterDoc?.toLowerCase().includes(needle) ||
        d.emitterName?.toLowerCase().includes(needle);
      if (!hit) return false;
    }
    if (f.receiver) {
      const needle = f.receiver.toLowerCase();
      const hit =
        cnpjIncludes(d.receiverDoc, f.receiver) ||
        d.receiverDoc?.toLowerCase().includes(needle) ||
        d.receiverName?.toLowerCase().includes(needle);
      if (!hit) return false;
    }
    if (f.emitterDoc) {
      const hit =
        cnpjIncludes(d.emitterDoc, f.emitterDoc) ||
        (d.emitterDoc || "").toLowerCase().includes(f.emitterDoc.toLowerCase());
      if (!hit) return false;
    }
    if (f.receiverDoc) {
      const hit =
        cnpjIncludes(d.receiverDoc, f.receiverDoc) ||
        (d.receiverDoc || "").toLowerCase().includes(f.receiverDoc.toLowerCase());
      if (!hit) return false;
    }

    if (min !== undefined && !Number.isNaN(min) && (d.totalValue ?? 0) < min) return false;
    if (max !== undefined && !Number.isNaN(max) && (d.totalValue ?? 0) > max) return false;
    if (qMin !== undefined && !Number.isNaN(qMin) && (d.qualityScore ?? -Infinity) < qMin) return false;
    if (qMax !== undefined && !Number.isNaN(qMax) && (d.qualityScore ?? Infinity) > qMax) return false;

    const issueDay = dayKey(d.issueDate);
    if (f.dateFrom && (!issueDay || issueDay < f.dateFrom)) return false;
    if (f.dateTo && (!issueDay || issueDay > f.dateTo)) return false;

    const docItems = itemsByDoc.get(d.id) || [];
    if (f.cfop && !docItems.some((i) => i.cfop === f.cfop)) return false;
    if (f.ncm && !docItems.some((i) => i.ncm === f.ncm)) return false;

    if (f.alert) {
      if (f.alert === "NO_KEY" && d.accessKey) return false;
      if (f.alert === "NO_PROTOCOL" && d.protocol) return false;
      if (f.alert === "PARSE_ERROR" && d.parseStatus !== "error") return false;
      if (f.alert === "HAS_ALERTS") {
        const hasFinding = (store.findings || []).some((x) => x.documentId === d.id);
        const hasWarn = (d.qualityScore ?? 100) < 70 || d.parseStatus !== "ok" || !!d.isDuplicate;
        if (!hasFinding && !hasWarn) return false;
      }
      if (f.alert === "NO_ALERTS") {
        const hasFinding = (store.findings || []).some((x) => x.documentId === d.id);
        if (hasFinding || d.parseStatus === "error" || d.isDuplicate) return false;
      }
      if (f.alert === "DUPLICATES") {
        if (!d.accessKey || (keyCount.get(d.accessKey) || 0) < 2) return false;
      }
      if (f.alert === "NO_NCM" && !docItems.some((i) => !i.ncm)) return false;
      if (f.alert === "NO_CFOP" && !docItems.some((i) => !i.cfop)) return false;
      if (f.alert === "OUTSIDE_PERIOD") {
        if (!store.batch.month || !store.batch.year || !d.issueDate) return false;
        const dt = new Date(d.issueDate);
        if (Number.isNaN(dt.getTime())) return false;
        const inPeriod =
          dt.getUTCMonth() + 1 === store.batch.month && dt.getUTCFullYear() === store.batch.year;
        if (inPeriod) return false;
      }
      if (f.alert === "ITEM_SUM_DIVERGENCE") {
        if (d.documentType !== "NFE" || !docItems.length || d.totalValue === undefined) return false;
        const sum = docItems.reduce((a, i) => a + (i.totalValue || 0), 0);
        if (Math.abs(sum - (d.productsValue ?? d.totalValue)) <= 0.5) return false;
      }
    }

    if (q) {
      const blob = [
        d.accessKey,
        d.number,
        d.series,
        d.model,
        d.emitterName,
        d.receiverName,
        d.emitterDoc,
        d.receiverDoc,
        d.fileName,
        d.protocol,
        d.natureOperation,
        d.cfopMain,
      ]
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q)) return false;
    }

    return true;
  });
}

export function filterItems(store: BatchStore, docs: DocumentSummary[], f: DocFilterState): DocumentItem[] {
  const ids = new Set(docs.map((d) => d.id));
  return store.items.filter((i) => {
    if (!ids.has(i.documentId)) return false;
    if (f.cfop && i.cfop !== f.cfop) return false;
    if (f.ncm && i.ncm !== f.ncm) return false;
    if (f.alert === "NO_NCM" && i.ncm) return false;
    if (f.alert === "NO_CFOP" && i.cfop) return false;
    return true;
  });
}

export type PartyRow = {
  doc: string;
  name: string;
  role: "emitter" | "receiver" | "both";
  count: number;
  total: number;
  firstDate?: string;
  lastDate?: string;
  types: Record<string, number>;
};

export function buildParties(store: BatchStore): PartyRow[] {
  const map = new Map<string, PartyRow>();

  const bump = (
    doc: string | undefined,
    name: string | undefined,
    role: "emitter" | "receiver",
    d: DocumentSummary,
  ) => {
    if (!doc) return;
    const cur = map.get(doc) || {
      doc,
      name: name || doc,
      role,
      count: 0,
      total: 0,
      types: {},
    };
    if (name && cur.name === cur.doc) cur.name = name;
    if (cur.role !== role) cur.role = "both";
    cur.count += 1;
    cur.total += d.totalValue || 0;
    cur.types[d.documentType] = (cur.types[d.documentType] || 0) + 1;
    if (d.issueDate) {
      if (!cur.firstDate || d.issueDate < cur.firstDate) cur.firstDate = d.issueDate;
      if (!cur.lastDate || d.issueDate > cur.lastDate) cur.lastDate = d.issueDate;
    }
    map.set(doc, cur);
  };

  for (const d of store.documents) {
    bump(d.emitterDoc, d.emitterName, "emitter", d);
    bump(d.receiverDoc, d.receiverName, "receiver", d);
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

export type BatchCompareResult = {
  a: { id: string; name: string; docs: number; value: number; score: number | null };
  b: { id: string; name: string; docs: number; value: number; score: number | null };
  deltaDocs: number;
  deltaValue: number;
  deltaScore: number | null;
  newEmitters: PartyRow[];
  goneEmitters: PartyRow[];
  recurringEmitters: Array<PartyRow & { prevTotal: number; delta: number }>;
  cfopDelta: Array<{ cfop: string; a: number; b: number; delta: number }>;
};

export function compareBatches(a: BatchStore, b: BatchStore): BatchCompareResult {
  const partiesA = buildParties(a).filter((p) => p.role === "emitter" || p.role === "both");
  const partiesB = buildParties(b).filter((p) => p.role === "emitter" || p.role === "both");
  const mapA = new Map(partiesA.map((p) => [p.doc, p]));
  const mapB = new Map(partiesB.map((p) => [p.doc, p]));

  const newEmitters = partiesB.filter((p) => !mapA.has(p.doc)).slice(0, 20);
  const goneEmitters = partiesA.filter((p) => !mapB.has(p.doc)).slice(0, 20);
  const recurringEmitters = partiesB
    .filter((p) => mapA.has(p.doc))
    .map((p) => {
      const prev = mapA.get(p.doc)!;
      return { ...p, prevTotal: prev.total, delta: p.total - prev.total };
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 20);

  const countCfop = (store: BatchStore) => {
    const m = new Map<string, number>();
    for (const i of store.items) {
      if (!i.cfop) continue;
      m.set(i.cfop, (m.get(i.cfop) || 0) + 1);
    }
    return m;
  };
  const ca = countCfop(a);
  const cb = countCfop(b);
  const keys = new Set([...ca.keys(), ...cb.keys()]);
  const cfopDelta = [...keys]
    .map((cfop) => {
      const av = ca.get(cfop) || 0;
      const bv = cb.get(cfop) || 0;
      return { cfop, a: av, b: bv, delta: bv - av };
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 15);

  return {
    a: {
      id: a.batch.id,
      name: a.batch.name,
      docs: a.batch.validXml,
      value: a.batch.totalValue,
      score: a.batch.healthScore,
    },
    b: {
      id: b.batch.id,
      name: b.batch.name,
      docs: b.batch.validXml,
      value: b.batch.totalValue,
      score: b.batch.healthScore,
    },
    deltaDocs: b.batch.validXml - a.batch.validXml,
    deltaValue: b.batch.totalValue - a.batch.totalValue,
    deltaScore:
      a.batch.healthScore == null || b.batch.healthScore == null
        ? null
        : b.batch.healthScore - a.batch.healthScore,
    newEmitters,
    goneEmitters,
    recurringEmitters,
    cfopDelta,
  };
}

export function alertHref(batchId: string, code: string) {
  return `/app/batches/${batchId}/documents?alert=${encodeURIComponent(code)}`;
}
