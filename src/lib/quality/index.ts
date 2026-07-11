import type {
  Batch,
  BatchEvaluationStatus,
  DocumentField,
  DocumentItem,
  DocumentSummary,
  MetricEvaluation,
  ParseError,
  QualityReport,
  QualityWarning,
} from "@/types";
import { isValidCnpjOrCpf } from "@/lib/fiscal/cnpj";

export const QUALITY_FORMULA_VERSION = "2.0.0";

export const QUALITY_WEIGHTS: Record<string, number> = {
  xmlValidity: 0.2,
  essentialFields: 0.2,
  duplicates: 0.1,
  dateConsistency: 0.1,
  valueConsistency: 0.15,
  itemCompleteness: 0.15,
  fiscalIdentification: 0.1,
};

function rankCounts(values: Array<string | undefined>, limit = 10) {
  const map = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function metricEvaluated(
  numerator: number,
  denominator: number,
  scoreFromRatio: (ratio: number) => number,
  reasons: string[] = [],
): MetricEvaluation {
  if (denominator <= 0) {
    return {
      status: "not_evaluated",
      score: null,
      numerator,
      denominator: 0,
      coverage: null,
      confidence: null,
      reasons: reasons.length ? reasons : ["Sem amostra para avaliar esta dimensão"],
    };
  }
  const ratio = numerator / denominator;
  return {
    status: "evaluated",
    score: clamp(scoreFromRatio(ratio)),
    numerator,
    denominator,
    coverage: 1,
    confidence: 1,
    reasons,
  };
}

function metricNA(reasons: string[]): MetricEvaluation {
  return {
    status: "not_applicable",
    score: null,
    numerator: 0,
    denominator: 0,
    coverage: null,
    confidence: null,
    reasons,
  };
}

function emptyReport(
  evaluationStatus: BatchEvaluationStatus,
  reusedDocumentCount: number,
  recommendations: string[],
  warnings: QualityWarning[] = [],
): QualityReport {
  const emptyDim = (reason: string): MetricEvaluation => ({
    status: "not_evaluated",
    score: null,
    numerator: 0,
    denominator: 0,
    coverage: null,
    confidence: null,
    reasons: [reason],
  });
  const reason = "Nenhum documento novo foi avaliado neste lote";
  return {
    score: null,
    evaluationStatus,
    formulaVersion: QUALITY_FORMULA_VERSION,
    weights: { ...QUALITY_WEIGHTS },
    dimensions: {
      xmlValidity: emptyDim(reason),
      essentialFields: emptyDim(reason),
      duplicates: emptyDim(reason),
      dateConsistency: emptyDim(reason),
      valueConsistency: emptyDim(reason),
      itemCompleteness: emptyDim(reason),
      fiscalIdentification: emptyDim(reason),
    },
    breakdown: {
      xmlValidity: null,
      essentialFields: null,
      duplicates: null,
      dateConsistency: null,
      valueConsistency: null,
      itemCompleteness: null,
      fiscalIdentification: null,
    },
    warnings,
    recommendations,
    metrics: {
      evaluatedDocumentCount: 0,
      reusedDocumentCount,
      validXmlPct: null,
      typeDistribution: { NFE: 0, CTE: 0, NFSE: 0, UNKNOWN: 0 },
      missingEssential: { accessKey: 0, number: 0, emitterDoc: 0, totalValue: 0 },
      topMissingFields: [],
      topFilledFields: [],
      topCfop: [],
      topNcm: [],
      topEmitters: [],
      topReceivers: [],
      topMunicipalities: [],
      valueOutliers: 0,
      itemSumDivergences: 0,
      zeroMonetary: 0,
      invalidCnpjFormat: 0,
      withoutKey: 0,
      withoutProtocol: 0,
      itemsWithoutNcm: 0,
      itemsWithoutCfop: 0,
      outsidePeriod: 0,
    },
  };
}

/**
 * Health Score 0–100 with explicit evaluation status.
 * Never awards 100 (or any score) when denominator === 0.
 * Never labels “saudável” when no documents were evaluated.
 */
export function calculateBatchQuality(
  batch: Batch,
  documents: DocumentSummary[],
  items: DocumentItem[],
  fields: DocumentField[],
  errors: ParseError[],
  options?: { reusedDocumentCount?: number },
): QualityReport {
  const reusedDocumentCount =
    options?.reusedDocumentCount ??
    batch.skippedDuplicateCount ??
    (batch.incremental && batch.newDocumentCount === 0 ? batch.totalXml || 0 : 0);

  if (documents.length === 0) {
    const warnings: QualityWarning[] = [];
    if (errors.length) {
      warnings.push({
        code: "PARSE_ERRORS",
        severity: "error",
        message: `${errors.length} arquivo(s) com erro de processamento.`,
        count: errors.length,
      });
    }
    if (reusedDocumentCount > 0 || (batch.incremental && (batch.newDocumentCount ?? 0) === 0)) {
      warnings.push({
        code: "NO_NEW_DOCUMENTS",
        severity: "info",
        message: `Nenhum documento novo foi avaliado. ${reusedDocumentCount || batch.totalXml || 0} arquivo(s) já conhecidos ou sem amostra.`,
        count: reusedDocumentCount || batch.totalXml || 0,
      });
      return emptyReport(
        reusedDocumentCount > 0 ? "duplicates_only" : "no_new_documents",
        reusedDocumentCount || batch.totalXml || 0,
        [
          "Nenhum documento novo foi avaliado — o score de saúde não se aplica.",
          "Abra os documentos originais nos lotes anteriores ou force reprocessamento com a versão atual do parser.",
        ],
        warnings,
      );
    }
    if (errors.length) {
      return emptyReport("processing_failed", 0, ["Processamento falhou sem documentos válidos."], warnings);
    }
    return emptyReport("not_evaluated", 0, ["Lote sem documentos para avaliar."], warnings);
  }

  const total = documents.length;
  const validDocs = documents.filter((d) => d.parseStatus !== "error");

  const xmlValidity = metricEvaluated(validDocs.length, total, (r) => r * 100, [
    "Documentos com parse ok/partial",
  ]);

  const missingEssential = {
    accessKey: documents.filter((d) => d.documentType !== "NFSE" && !d.accessKey).length,
    number: documents.filter((d) => !d.number).length,
    emitterDoc: documents.filter((d) => !d.emitterDoc).length,
    totalValue: documents.filter((d) => d.totalValue === undefined).length,
  };
  const essentialFailures = Math.max(
    missingEssential.accessKey,
    missingEssential.number,
    missingEssential.emitterDoc,
    missingEssential.totalValue,
  );
  const essentialFields = metricEvaluated(total - essentialFailures, total, (r) => r * 100);

  const keyMap = new Map<string, number>();
  for (const d of documents) {
    if (!d.accessKey) continue;
    keyMap.set(d.accessKey, (keyMap.get(d.accessKey) || 0) + 1);
  }
  const duplicateCount = [...keyMap.values()].filter((c) => c > 1).reduce((a, b) => a + b, 0);
  const duplicates = metricEvaluated(duplicateCount, total, (r) => 100 - r * 200);

  let outsidePeriod = 0;
  let dated = 0;
  if (batch.month && batch.year) {
    for (const d of documents) {
      if (!d.issueDate) continue;
      dated += 1;
      const dt = new Date(d.issueDate);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getUTCMonth() + 1 !== batch.month || dt.getUTCFullYear() !== batch.year) {
        outsidePeriod += 1;
      }
    }
  }
  const dateConsistency =
    batch.month && batch.year
      ? metricEvaluated(dated - outsidePeriod, dated || 0, (r) => r * 100, [
          dated === 0 ? "Nenhuma data de emissão para confrontar o período" : "Datas no mês/ano do lote",
        ])
      : metricNA(["Período do lote não informado"]);

  const negativeOrWeird = documents.filter(
    (d) => d.totalValue !== undefined && (d.totalValue < 0 || d.totalValue > 1e9),
  ).length;
  const zeroMonetary = documents.filter((d) => d.totalValue === 0).length;
  let itemSumDivergences = 0;
  for (const d of documents.filter((x) => x.documentType === "NFE" || x.documentType === "NFCE")) {
    const docItems = items.filter((i) => i.documentId === d.id);
    if (!docItems.length || d.totalValue === undefined) continue;
    const sum = docItems.reduce((acc, i) => acc + (i.totalValue || 0), 0);
    if (Math.abs(sum - (d.productsValue ?? d.totalValue)) > 0.5) itemSumDivergences += 1;
  }
  const valuePenaltyDocs = negativeOrWeird + itemSumDivergences;
  const valueConsistency = metricEvaluated(
    Math.max(0, total - valuePenaltyDocs),
    total,
    (r) => clamp(r * 100 - (zeroMonetary / total) * 10),
  );

  const nfeItems = items.filter((i) => i.documentType === "NFE" || i.documentType === "NFCE");
  const itemsWithoutNcm = nfeItems.filter((i) => !i.ncm).length;
  const itemsWithoutCfop = nfeItems.filter((i) => !i.cfop).length;
  const itemCompleteness =
    nfeItems.length === 0
      ? metricNA(["Sem itens NF-e/NFC-e neste lote"])
      : metricEvaluated(
          nfeItems.length * 2 - itemsWithoutNcm - itemsWithoutCfop,
          nfeItems.length * 2,
          (r) => r * 100,
        );

  const invalidCnpjFormat = documents.filter(
    (d) => !isValidCnpjOrCpf(d.emitterDoc) || !isValidCnpjOrCpf(d.receiverDoc),
  ).length;
  const withoutKey = missingEssential.accessKey;
  const protocolEligible = documents.filter(
    (d) => d.documentType === "NFE" || d.documentType === "NFCE" || d.documentType === "CTE",
  );
  const withoutProtocol = protocolEligible.filter((d) => !d.protocol).length;
  const fiscalDenom = total + withoutKey + protocolEligible.length;
  const fiscalNumerator =
    total -
    invalidCnpjFormat +
    (total - withoutKey) +
    (protocolEligible.length - withoutProtocol);
  const fiscalIdentification = metricEvaluated(
    Math.max(0, fiscalNumerator),
    Math.max(fiscalDenom, 1),
    (r) => r * 100,
  );

  const dims = {
    xmlValidity,
    essentialFields,
    duplicates,
    dateConsistency,
    valueConsistency,
    itemCompleteness,
    fiscalIdentification,
  };

  const evaluatedDims = Object.entries(dims).filter(([, d]) => d.status === "evaluated" && d.score != null);
  let score: number | null = null;
  if (evaluatedDims.length > 0) {
    let weightSum = 0;
    let acc = 0;
    for (const [key, dim] of evaluatedDims) {
      const w = QUALITY_WEIGHTS[key] ?? 0;
      weightSum += w;
      acc += (dim.score as number) * w;
    }
    score = weightSum > 0 ? Math.round(acc / weightSum) : null;
  }

  const pathStats = new Map<string, { filled: number; total: number }>();
  for (const f of fields) {
    const key = f.pathNormalized;
    const cur = pathStats.get(key) || { filled: 0, total: 0 };
    cur.total += 1;
    if (!f.isEmpty) cur.filled += 1;
    pathStats.set(key, cur);
  }
  const pathEntries = [...pathStats.entries()].map(([path, s]) => ({
    path,
    filledPct: (s.filled / s.total) * 100,
    missingPct: 100 - (s.filled / s.total) * 100,
  }));

  const topEmittersMap = new Map<string, { doc: string; name: string; total: number; count: number }>();
  for (const d of documents) {
    if (!d.emitterDoc) continue;
    const cur = topEmittersMap.get(d.emitterDoc) || {
      doc: d.emitterDoc,
      name: d.emitterName || d.emitterDoc,
      total: 0,
      count: 0,
    };
    cur.total += d.totalValue || 0;
    cur.count += 1;
    topEmittersMap.set(d.emitterDoc, cur);
  }

  const topReceiversMap = new Map<string, { doc: string; name: string; total: number; count: number }>();
  for (const d of documents) {
    if (!d.receiverDoc) continue;
    const cur = topReceiversMap.get(d.receiverDoc) || {
      doc: d.receiverDoc,
      name: d.receiverName || d.receiverDoc,
      total: 0,
      count: 0,
    };
    cur.total += d.totalValue || 0;
    cur.count += 1;
    topReceiversMap.set(d.receiverDoc, cur);
  }

  const warnings: QualityWarning[] = [];
  if (errors.length)
    warnings.push({
      code: "PARSE_ERRORS",
      severity: "error",
      message: `${errors.length} arquivo(s) com erro de processamento.`,
      count: errors.length,
    });
  if (duplicateCount)
    warnings.push({
      code: "DUPLICATES",
      severity: "warning",
      message: `${duplicateCount} documento(s) com chave duplicada.`,
      count: duplicateCount,
    });
  if (withoutKey)
    warnings.push({
      code: "NO_KEY",
      severity: "warning",
      message: `${withoutKey} documento(s) sem chave de acesso.`,
      count: withoutKey,
    });
  if (withoutProtocol && protocolEligible.length) {
    const pct = (withoutProtocol / protocolEligible.length) * 100;
    warnings.push({
      code: "NO_PROTOCOL",
      severity: pct >= 60 ? "info" : "warning",
      message:
        pct >= 60
          ? `${withoutProtocol} nota(s) sem protocolo (${Math.round(pct)}% elegíveis). Incidência excepcional — revise parser/origem.`
          : `${withoutProtocol} nota(s) sem protocolo de autorização (revisão recomendada).`,
      count: withoutProtocol,
    });
  }
  if (itemsWithoutNcm)
    warnings.push({
      code: "NO_NCM",
      severity: "info",
      message: `${itemsWithoutNcm} item(ns) sem NCM.`,
      count: itemsWithoutNcm,
    });
  if (itemsWithoutCfop)
    warnings.push({
      code: "NO_CFOP",
      severity: "info",
      message: `${itemsWithoutCfop} item(ns) sem CFOP.`,
      count: itemsWithoutCfop,
    });
  if (outsidePeriod)
    warnings.push({
      code: "OUTSIDE_PERIOD",
      severity: "warning",
      message: `${outsidePeriod} documento(s) fora do mês/ano do lote.`,
      count: outsidePeriod,
    });
  if (itemSumDivergences)
    warnings.push({
      code: "ITEM_SUM_DIVERGENCE",
      severity: "warning",
      message: `Soma de itens diverge do total em ${itemSumDivergences} nota(s).`,
      count: itemSumDivergences,
    });

  let evaluationStatus: BatchEvaluationStatus = "analyzed";
  if (errors.length && validDocs.length === 0) evaluationStatus = "processing_failed";
  else if (errors.length || (score != null && score < 60)) evaluationStatus = "analyzed_with_errors";
  else if (warnings.some((w) => w.severity === "warning")) evaluationStatus = "analyzed_with_warnings";

  const recommendations: string[] = [];
  if (score != null && score < 70)
    recommendations.push("Revise XMLs inválidos e reexporte o lote na origem se necessário.");
  if (duplicateCount) recommendations.push("Remova duplicatas antes de consolidar análises.");
  if (itemsWithoutNcm || itemsWithoutCfop)
    recommendations.push("Complete NCM/CFOP nos itens para análises fiscais mais precisas.");
  if (outsidePeriod) recommendations.push("Confirme o mês/ano informado no upload do lote.");
  if (!recommendations.length && score != null && score >= 80) {
    recommendations.push("Lote analisado sem alertas bloqueantes. Revise exports antes de decisões fiscais.");
  } else if (!recommendations.length) {
    recommendations.push("Lote analisado. Verifique as dimensões e alertas abaixo.");
  }

  const values = documents.map((d) => d.totalValue || 0).filter((v) => v > 0);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const valueOutliers = values.filter((v) => avg > 0 && (v > avg * 5 || v < avg * 0.05)).length;

  return {
    score,
    evaluationStatus,
    formulaVersion: QUALITY_FORMULA_VERSION,
    weights: { ...QUALITY_WEIGHTS },
    dimensions: dims,
    breakdown: {
      xmlValidity: xmlValidity.score,
      essentialFields: essentialFields.score,
      duplicates: duplicates.score,
      dateConsistency: dateConsistency.score,
      valueConsistency: valueConsistency.score,
      itemCompleteness: itemCompleteness.score,
      fiscalIdentification: fiscalIdentification.score,
    },
    warnings,
    recommendations,
    metrics: {
      evaluatedDocumentCount: total,
      reusedDocumentCount,
      validXmlPct: xmlValidity.score,
      typeDistribution: {
        NFE: documents.filter((d) => d.documentType === "NFE" || d.documentType === "NFCE").length,
        CTE: documents.filter((d) => d.documentType === "CTE").length,
        NFSE: documents.filter((d) => d.documentType === "NFSE").length,
        UNKNOWN: documents.filter((d) => d.documentType === "UNKNOWN").length,
      },
      missingEssential,
      topMissingFields: [...pathEntries]
        .sort((a, b) => b.missingPct - a.missingPct)
        .slice(0, 10)
        .map(({ path, missingPct }) => ({ path, missingPct: Math.round(missingPct) })),
      topFilledFields: [...pathEntries]
        .sort((a, b) => b.filledPct - a.filledPct)
        .slice(0, 10)
        .map(({ path, filledPct }) => ({ path, filledPct: Math.round(filledPct) })),
      topCfop: rankCounts(items.map((i) => i.cfop)),
      topNcm: rankCounts(items.map((i) => i.ncm)),
      topEmitters: [...topEmittersMap.values()].sort((a, b) => b.total - a.total).slice(0, 10),
      topReceivers: [...topReceiversMap.values()].sort((a, b) => b.total - a.total).slice(0, 10),
      topMunicipalities: rankCounts(
        documents.map((d) => d.emitterCity || d.receiverCity || d.serviceCity),
      ),
      valueOutliers,
      itemSumDivergences,
      zeroMonetary,
      invalidCnpjFormat,
      withoutKey,
      withoutProtocol,
      itemsWithoutNcm,
      itemsWithoutCfop,
      outsidePeriod,
    },
  };
}

export function formatHealthScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "—";
  return String(score);
}

export function evaluationStatusLabel(status: BatchEvaluationStatus | undefined): string {
  switch (status) {
    case "analyzed":
      return "Analisado";
    case "analyzed_with_warnings":
      return "Analisado com alertas";
    case "analyzed_with_errors":
      return "Analisado com erros";
    case "no_new_documents":
      return "Nenhum documento novo";
    case "duplicates_only":
      return "Somente documentos já conhecidos";
    case "processing_failed":
      return "Falha de processamento";
    case "partial_processing":
      return "Processamento parcial";
    case "insufficient_coverage":
      return "Cobertura insuficiente";
    case "not_evaluated":
    default:
      return "Não avaliado";
  }
}
