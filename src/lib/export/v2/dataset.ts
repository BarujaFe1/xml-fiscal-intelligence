import type { AuditFinding, BatchStore, DocumentSummary, DocumentItem } from "@/types";
import { moneyAdd, moneyToFixed } from "@/lib/money/decimal";
import { detectDocumentRtcLabels } from "@/lib/documents/rtc-labels";
import { createGenerationId } from "@/lib/export/manifest";
import {
  applyAccessKey,
  applyPartyDoc,
  resolvePrivacyPolicy,
} from "@/lib/export/v2/privacy";
import { sanitizeHumanText } from "@/lib/export/v2/text";
import {
  EXPORT_DATASET_SCHEMA,
  type ExportCsvProfile,
  type ExportDatasetV2,
  type ExportDocument,
  type ExportFinding,
  type ExportItem,
  type ExportJsonProfile,
  type ExportManifestV2,
  type ExportPreflight,
  type ExportPrivacyPolicy,
  type ExportPrivacyProfile,
  type ExportRelationship,
  type ExportSelectionSnapshot,
  type ExportSummary,
  type RawXmlAvailability,
} from "@/lib/export/v2/types";

export type BuildExportDatasetOptions = {
  filters?: Record<string, unknown>;
  privacyProfile?: ExportPrivacyProfile;
  privacyOverride?: Partial<ExportPrivacyPolicy>;
  /** Include raw/flattened structures (audit_full). Default false. */
  includeRawStructures?: boolean;
  /** documentId → availability (optional; omit means unknown / not loaded) */
  rawXmlAvailability?: RawXmlAvailability[];
  jsonProfile?: ExportJsonProfile;
  snappedAt?: string;
};

function moneyStr(v: number | string | null | undefined): string {
  return moneyToFixed(v ?? 0, 2);
}

function informedCompetence(batch: BatchStore["batch"]): string | undefined {
  if (batch.month && batch.year) {
    return `${String(batch.month).padStart(2, "0")}/${batch.year}`;
  }
  return undefined;
}

function issueYm(issueDate?: string): { y: number; m: number } | null {
  if (!issueDate) return null;
  const dt = new Date(issueDate);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1 };
}

function realPeriod(docs: DocumentSummary[]): { min?: string; max?: string } {
  const dates = docs
    .map((d) => d.issueDate)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return {};
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { min: fmt(dates[0]!), max: fmt(dates[dates.length - 1]!) };
}

function countOutsideCompetence(docs: DocumentSummary[], batch: BatchStore["batch"]): number {
  if (!batch.month || !batch.year) return 0;
  let n = 0;
  for (const d of docs) {
    const ym = issueYm(d.issueDate);
    if (!ym) continue;
    if (ym.m !== batch.month || ym.y !== batch.year) n += 1;
  }
  return n;
}

function mapDocument(
  d: DocumentSummary,
  itemsByDoc: Map<string, DocumentItem[]>,
  privacy: ExportPrivacyPolicy,
  includeRaw: boolean,
): ExportDocument {
  const rtc = detectDocumentRtcLabels(d, itemsByDoc.get(d.id));
  const base: ExportDocument = {
    id: d.id,
    documentType: d.documentType,
    fileName: d.fileName,
    accessKey: applyAccessKey(d.accessKey, privacy) || undefined,
    number: d.number,
    series: d.series,
    model: d.model,
    issueDate: d.issueDate,
    authorizationDate: d.authorizationDate,
    emitterDoc: applyPartyDoc(d.emitterDoc, privacy) || undefined,
    emitterName: sanitizeHumanText(d.emitterName) || undefined,
    emitterUf: d.emitterUf,
    receiverDoc: applyPartyDoc(d.receiverDoc, privacy) || undefined,
    receiverName: sanitizeHumanText(d.receiverName) || undefined,
    receiverUf: d.receiverUf,
    natureOperation: sanitizeHumanText(d.natureOperation) || undefined,
    cfopMain: d.cfopMain,
    totalValue: moneyStr(d.totalValue),
    productsValue: moneyStr(d.productsValue),
    servicesValue: moneyStr(d.servicesValue),
    freightValue: moneyStr(d.freightValue),
    discountValue: moneyStr(d.discountValue),
    taxValue: moneyStr(d.taxValue),
    status: d.status,
    protocol: d.protocol,
    parseStatus: d.parseStatus,
    parseErrors: [...(d.parseErrors || [])],
    qualityScore: d.qualityScore,
    isDuplicate: d.isDuplicate,
    etiquetaCbs: rtc.hasCbs ? "sim" : "nao",
    somaCbs: moneyStr(rtc.somaCbs ?? 0),
    etiquetaIbs: rtc.hasIbs ? "sim" : "nao",
    somaIbs: moneyStr(rtc.somaIbs ?? 0),
  };
  if (includeRaw) {
    base.flattenedJson = d.flattenedJson;
    base.rawJson = d.rawJson;
  }
  return base;
}

function mapItem(
  item: DocumentItem,
  doc: DocumentSummary | undefined,
  privacy: ExportPrivacyPolicy,
  includeRaw: boolean,
): ExportItem {
  const out: ExportItem = {
    id: item.id,
    documentId: item.documentId,
    documentType: item.documentType,
    itemNumber: item.itemNumber,
    code: item.code,
    description: sanitizeHumanText(item.description) || undefined,
    ncm: item.ncm,
    cest: item.cest,
    cfop: item.cfop,
    cst: item.cst,
    csosn: item.csosn,
    unit: item.unit,
    quantity:
      item.quantity === undefined || item.quantity === null
        ? undefined
        : moneyToFixed(item.quantity, 4),
    unitValue: moneyStr(item.unitValue),
    totalValue: moneyStr(item.totalValue),
    discountValue: moneyStr(item.discountValue),
    accessKey: applyAccessKey(doc?.accessKey, privacy) || undefined,
    noteNumber: doc?.number,
    emitterName: sanitizeHumanText(doc?.emitterName) || undefined,
  };
  if (includeRaw) {
    out.taxJson = item.taxJson;
    out.flattenedJson = item.flattenedJson;
  }
  return out;
}

function mapFinding(f: AuditFinding): ExportFinding {
  return {
    id: f.id,
    documentId: f.documentId,
    severity: f.severity,
    category: f.category,
    code: f.code,
    title: sanitizeHumanText(f.title),
    description: sanitizeHumanText(f.description),
    status: f.status,
  };
}

/**
 * Unique canonical export snapshot. Pure: never mutates `store`.
 * Does not load raw XML bytes — only optional availability metadata.
 */
export function buildExportDataset(
  store: BatchStore,
  selectedDocumentIds: Iterable<string>,
  options: BuildExportDatasetOptions = {},
): ExportDatasetV2 {
  const privacy = {
    ...resolvePrivacyPolicy(options.privacyProfile || "operational_full"),
    ...options.privacyOverride,
  };
  if (options.includeRawStructures) {
    privacy.includeRawStructures = true;
  }
  const includeRaw = Boolean(privacy.includeRawStructures);

  const requestedIds = [...new Set(selectedDocumentIds)];
  const requested = new Set(requestedIds);
  const documentsRaw = store.documents.filter((d) => requested.has(d.id));
  const foundIds = new Set(documentsRaw.map((d) => d.id));
  const missingIds = requestedIds.filter((id) => !foundIds.has(id));

  const itemsRaw = store.items.filter((i) => foundIds.has(i.documentId));
  const findingsRaw = (store.findings || []).filter(
    (f) => !f.documentId || foundIds.has(f.documentId),
  );
  const relationshipsRaw = (store.relationships || []).filter(
    (r) => foundIds.has(r.sourceDocumentId) && foundIds.has(r.targetDocumentId),
  );

  const itemsByDoc = new Map<string, DocumentItem[]>();
  for (const item of itemsRaw) {
    const list = itemsByDoc.get(item.documentId);
    if (list) list.push(item);
    else itemsByDoc.set(item.documentId, [item]);
  }

  const docById = new Map(documentsRaw.map((d) => [d.id, d]));
  const documents = documentsRaw.map((d) => mapDocument(d, itemsByDoc, privacy, includeRaw));
  const items = itemsRaw.map((i) => mapItem(i, docById.get(i.documentId), privacy, includeRaw));
  const findings = findingsRaw.map(mapFinding);
  const relationships: ExportRelationship[] = relationshipsRaw.map((r) => ({
    id: r.id,
    sourceDocumentId: r.sourceDocumentId,
    targetDocumentId: r.targetDocumentId,
    relationshipType: r.relationshipType,
    confidenceScore: r.confidenceScore,
  }));

  const availInput = options.rawXmlAvailability || [];
  const availById = new Map(availInput.map((a) => [a.documentId, a]));
  const rawXmlAvailability: RawXmlAvailability[] = documentsRaw.map((d) => {
    const known = availById.get(d.id);
    if (known) return known;
    return { documentId: d.id, available: false, fileName: d.fileName, xmlHash: d.xmlHash };
  });

  const xmlAvailableCount = rawXmlAvailability.filter((a) => a.available).length;
  const xmlMissingCount = documentsRaw.length - xmlAvailableCount;
  const period = realPeriod(documentsRaw);
  const outside = countOutsideCompetence(documentsRaw, store.batch);
  const competence = informedCompetence(store.batch);
  const competenceMismatch = Boolean(competence && outside > 0);

  const byType: Record<string, number> = {};
  const byParseStatus: Record<string, number> = {};
  for (const d of documentsRaw) {
    byType[d.documentType] = (byType[d.documentType] || 0) + 1;
    byParseStatus[d.parseStatus] = (byParseStatus[d.parseStatus] || 0) + 1;
  }
  const bySeverity: Record<string, number> = {};
  for (const f of findingsRaw) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }

  const totalValue = moneyToFixed(
    moneyAdd(...documentsRaw.map((d) => d.totalValue ?? 0)),
    2,
  );

  const snappedAt = options.snappedAt || new Date().toISOString();
  const selection: ExportSelectionSnapshot = {
    requestedIds: [...requestedIds],
    foundIds: [...foundIds],
    missingIds: [...missingIds],
    filters: options.filters || {},
    snappedAt,
  };

  const summary: ExportSummary = {
    batchId: store.batch.id,
    batchName: store.batch.name,
    uploadedFileName: store.batch.uploadedFileName,
    informedCompetence: competence,
    realPeriodMin: period.min,
    realPeriodMax: period.max,
    competenceMismatch,
    outsideCompetenceCount: outside,
    documentCount: documents.length,
    itemCount: items.length,
    findingCount: findings.length,
    relationshipCount: relationships.length,
    xmlAvailableCount,
    xmlMissingCount,
    parseErrorCount: documentsRaw.filter((d) => d.parseStatus === "error").length,
    duplicateCount: documentsRaw.filter((d) => d.isDuplicate).length,
    byType,
    byParseStatus,
    bySeverity,
    totalValue,
    healthScore: store.batch.healthScore,
  };

  const preflightWarnings: string[] = [];
  if (competenceMismatch) {
    preflightWarnings.push(
      `Competência informada (${competence}) diverge do período real dos documentos (${period.min || "?"} a ${period.max || "?"}): ${outside} documento(s) fora da competência.`,
    );
  }
  if (missingIds.length) {
    preflightWarnings.push(`${missingIds.length} ID(s) selecionado(s) não encontrado(s) no lote.`);
  }
  if (xmlMissingCount) {
    preflightWarnings.push(`${xmlMissingCount} documento(s) sem XML original local.`);
  }
  if (!documents.length) {
    preflightWarnings.push("Seleção vazia — nenhum documento exportável.");
  }

  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    timezone = "UTC";
  }

  const manifest: ExportManifestV2 = {
    schemaVersion: EXPORT_DATASET_SCHEMA,
    generationId: createGenerationId(),
    generatedAt: snappedAt,
    timezone,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    buildCommit:
      (typeof process !== "undefined" &&
        (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
          process.env.VERCEL_GIT_COMMIT_SHA ||
          process.env.GIT_COMMIT)) ||
      "local",
    workspaceId: store.batch.workspaceId,
    batchId: store.batch.id,
    batchName: store.batch.name,
    filters: options.filters || {},
    privacy,
    informedCompetence: competence,
    realPeriodMin: period.min,
    realPeriodMax: period.max,
    preflightWarnings,
    counts: {
      requested: requestedIds.length,
      documents: documents.length,
      items: items.length,
      findings: findings.length,
      relationships: relationships.length,
      xmlAvailable: xmlAvailableCount,
      xmlMissing: xmlMissingCount,
      missingIds: missingIds.length,
    },
    totals: { totalValue },
    parserVersions: ["xml-fiscal-parser@local"],
    disclaimer:
      "Exportação analítica interna. Não constitui apuração oficial, SPED validado pelo PVA nem conformidade fiscal automática.",
    emptyReason: documents.length === 0 ? "no_records_in_selection" : null,
  };

  return {
    schemaVersion: EXPORT_DATASET_SCHEMA,
    selection,
    privacy,
    summary,
    documents,
    items,
    findings,
    relationships,
    rawXmlAvailability,
    manifest,
  };
}

/** Preflight from an already-built dataset (or build first). */
export function buildExportPreflight(
  dataset: ExportDatasetV2,
  csvProfile: ExportCsvProfile = "excel_pt_br",
): ExportPreflight {
  const { summary, privacy, selection, manifest } = dataset;
  const docBytes = summary.documentCount * 800 + summary.itemCount * 400;
  const estimatedBytes: Record<string, number> = {
    xlsx: Math.round(docBytes * 1.4 + 40_000),
    "csv-docs": Math.round(summary.documentCount * 350 + 2_000),
    "csv-items": Math.round(summary.itemCount * 280 + 2_000),
    "csv-zip": Math.round((summary.documentCount * 350 + summary.itemCount * 280) * 0.35 + 8_000),
    json: Math.round(docBytes * (privacy.includeRawStructures ? 8 : 1.2) + 8_000),
    html: Math.round(summary.documentCount * 220 + 12_000),
    "keys-txt": Math.round(summary.documentCount * 46 + 64),
    "xml-zip": Math.round(summary.xmlAvailableCount * 12_000 + 8_000),
    package: Math.round(docBytes * 2.2 + summary.xmlAvailableCount * 12_000 + 30_000),
  };
  // csvProfile only affects estimate slightly
  if (csvProfile === "integration") {
    estimatedBytes["csv-docs"] = Math.round((estimatedBytes["csv-docs"] || 0) * 0.98);
  }

  return {
    requested: selection.requestedIds.length,
    found: summary.documentCount,
    missingIds: selection.missingIds.length,
    xmlAvailable: summary.xmlAvailableCount,
    xmlMissing: summary.xmlMissingCount,
    byType: { ...summary.byType },
    realPeriodMin: summary.realPeriodMin,
    realPeriodMax: summary.realPeriodMax,
    informedCompetence: summary.informedCompetence,
    outsideCompetenceCount: summary.outsideCompetenceCount,
    parseErrorCount: summary.parseErrorCount,
    duplicateCount: summary.duplicateCount,
    totalValue: summary.totalValue,
    privacy,
    warnings: [...manifest.preflightWarnings],
    estimatedBytes,
    requiresCompetenceAck: summary.competenceMismatch,
  };
}
