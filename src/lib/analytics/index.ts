import type { BatchStore, DocumentItem, DocumentSummary } from "@/types";

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
  return n;
}

function itemsForDoc(store: BatchStore, docId: string) {
  return store.items.filter((i) => i.documentId === docId);
}

export function filterDocuments(store: BatchStore, f: DocFilterState): DocumentSummary[] {
  const min = f.minValue ? Number(f.minValue) : undefined;
  const max = f.maxValue ? Number(f.maxValue) : undefined;
  const q = f.q.trim().toLowerCase();

  // Duplicate keys set
  const keyCount = new Map<string, number>();
  for (const d of store.documents) {
    if (!d.accessKey) continue;
    keyCount.set(d.accessKey, (keyCount.get(d.accessKey) || 0) + 1);
  }

  return store.documents.filter((d) => {
    if (f.type !== "ALL" && d.documentType !== f.type) return false;
    if (f.parse && d.parseStatus !== f.parse) return false;
    if (f.uf && d.emitterUf !== f.uf && d.receiverUf !== f.uf) return false;
    if (f.emitter) {
      const needle = f.emitter.toLowerCase();
      const hit =
        d.emitterDoc?.includes(f.emitter.replace(/\D/g, "")) ||
        d.emitterDoc?.toLowerCase().includes(needle) ||
        d.emitterName?.toLowerCase().includes(needle);
      if (!hit) return false;
    }
    if (f.receiver) {
      const needle = f.receiver.toLowerCase();
      const hit =
        d.receiverDoc?.includes(f.receiver.replace(/\D/g, "")) ||
        d.receiverDoc?.toLowerCase().includes(needle) ||
        d.receiverName?.toLowerCase().includes(needle);
      if (!hit) return false;
    }
    if (min !== undefined && !Number.isNaN(min) && (d.totalValue ?? 0) < min) return false;
    if (max !== undefined && !Number.isNaN(max) && (d.totalValue ?? 0) > max) return false;

    const docItems = itemsForDoc(store, d.id);
    if (f.cfop && !docItems.some((i) => i.cfop === f.cfop)) return false;
    if (f.ncm && !docItems.some((i) => i.ncm === f.ncm)) return false;

    if (f.alert) {
      if (f.alert === "NO_KEY" && d.accessKey) return false;
      if (f.alert === "NO_PROTOCOL" && d.protocol) return false;
      if (f.alert === "PARSE_ERROR" && d.parseStatus !== "error") return false;
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
        d.emitterName,
        d.receiverName,
        d.emitterDoc,
        d.receiverDoc,
        d.fileName,
        d.protocol,
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
  a: { id: string; name: string; docs: number; value: number; score: number };
  b: { id: string; name: string; docs: number; value: number; score: number };
  deltaDocs: number;
  deltaValue: number;
  deltaScore: number;
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
    deltaScore: b.batch.healthScore - a.batch.healthScore,
    newEmitters,
    goneEmitters,
    recurringEmitters,
    cfopDelta,
  };
}

export function alertHref(batchId: string, code: string) {
  return `/app/batches/${batchId}/documents?alert=${encodeURIComponent(code)}`;
}
