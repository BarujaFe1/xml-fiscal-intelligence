import type {
  Batch,
  DocumentField,
  DocumentItem,
  DocumentSummary,
  ParseError,
  QualityReport,
  QualityWarning,
} from "@/types";
import { isValidCnpjOrCpf } from "@/lib/fiscal/cnpj";

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

function isValidCnpjCpfFormat(doc?: string) {
  return isValidCnpjOrCpf(doc);
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Health Score 0–100
 *
 * Weights (documented in README):
 * - xmlValidity (20): % documentos com parse ok/partial
 * - essentialFields (20): chave/número/emitente/valor presentes
 * - duplicates (10): penalidade por duplicatas de chave
 * - dateConsistency (10): datas válidas / dentro do mês do lote
 * - valueConsistency (15): valores >= 0 e soma itens ≈ total
 * - itemCompleteness (15): NCM/CFOP em itens NF-e
 * - fiscalIdentification (10): CNPJ/CPF formato + protocolo quando aplicável
 */
export function calculateBatchQuality(
  batch: Batch,
  documents: DocumentSummary[],
  items: DocumentItem[],
  fields: DocumentField[],
  errors: ParseError[],
): QualityReport {
  const total = documents.length || 1;
  const validDocs = documents.filter((d) => d.parseStatus !== "error");
  const validXmlPct = (validDocs.length / total) * 100;

  const typeDistribution: Record<string, number> = {
    NFE: documents.filter((d) => d.documentType === "NFE" || d.documentType === "NFCE").length,
    CTE: documents.filter((d) => d.documentType === "CTE").length,
    NFSE: documents.filter((d) => d.documentType === "NFSE").length,
    UNKNOWN: documents.filter((d) => d.documentType === "UNKNOWN").length,
  };

  const missingEssential: Record<string, number> = {
    accessKey: documents.filter((d) => d.documentType !== "NFSE" && !d.accessKey).length,
    number: documents.filter((d) => !d.number).length,
    emitterDoc: documents.filter((d) => !d.emitterDoc).length,
    totalValue: documents.filter((d) => d.totalValue === undefined).length,
  };

  const essentialOk =
    total -
    Math.max(
      missingEssential.accessKey,
      missingEssential.number,
      missingEssential.emitterDoc,
      missingEssential.totalValue,
    );
  const essentialPct = (essentialOk / total) * 100;

  const keyMap = new Map<string, number>();
  for (const d of documents) {
    if (!d.accessKey) continue;
    keyMap.set(d.accessKey, (keyMap.get(d.accessKey) || 0) + 1);
  }
  const duplicateCount = [...keyMap.values()].filter((c) => c > 1).reduce((a, b) => a + b, 0);
  const duplicatePct = (duplicateCount / total) * 100;

  let outsidePeriod = 0;
  if (batch.month && batch.year) {
    for (const d of documents) {
      if (!d.issueDate) continue;
      const dt = new Date(d.issueDate);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getUTCMonth() + 1 !== batch.month || dt.getUTCFullYear() !== batch.year) {
        outsidePeriod += 1;
      }
    }
  }
  const dateScore = clamp(100 - (outsidePeriod / total) * 100);

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
  const valueScore = clamp(
    100 - ((negativeOrWeird + itemSumDivergences) / total) * 50 - (zeroMonetary / total) * 10,
  );

  const nfeItems = items.filter((i) => i.documentType === "NFE" || i.documentType === "NFCE");
  const itemsWithoutNcm = nfeItems.filter((i) => !i.ncm).length;
  const itemsWithoutCfop = nfeItems.filter((i) => !i.cfop).length;
  const itemBase = nfeItems.length || 1;
  const itemCompleteness = clamp(
    100 - ((itemsWithoutNcm + itemsWithoutCfop) / (itemBase * 2)) * 100,
  );

  const invalidCnpjFormat = documents.filter(
    (d) => !isValidCnpjCpfFormat(d.emitterDoc) || !isValidCnpjCpfFormat(d.receiverDoc),
  ).length;
  const withoutKey = missingEssential.accessKey;
  const withoutProtocol = documents.filter(
    (d) =>
      (d.documentType === "NFE" || d.documentType === "NFCE" || d.documentType === "CTE") && !d.protocol,
  ).length;
  const fiscalIdentification = clamp(
    100 - ((invalidCnpjFormat + withoutKey + withoutProtocol) / (total * 3)) * 100,
  );

  const xmlValidity = clamp(validXmlPct);
  const essentialFields = clamp(essentialPct);
  const duplicates = clamp(100 - duplicatePct * 2);

  const score = Math.round(
    xmlValidity * 0.2 +
      essentialFields * 0.2 +
      duplicates * 0.1 +
      dateScore * 0.1 +
      valueScore * 0.15 +
      itemCompleteness * 0.15 +
      fiscalIdentification * 0.1,
  );

  // Field coverage
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
  const topMissingFields = [...pathEntries]
    .sort((a, b) => b.missingPct - a.missingPct)
    .slice(0, 10)
    .map(({ path, missingPct }) => ({ path, missingPct: Math.round(missingPct) }));
  const topFilledFields = [...pathEntries]
    .sort((a, b) => b.filledPct - a.filledPct)
    .slice(0, 10)
    .map(({ path, filledPct }) => ({ path, filledPct: Math.round(filledPct) }));

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
  const topEmitters = [...topEmittersMap.values()].sort((a, b) => b.total - a.total).slice(0, 10);

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
  const topReceivers = [...topReceiversMap.values()].sort((a, b) => b.total - a.total).slice(0, 10);

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
  if (withoutProtocol) {
    const pct = (withoutProtocol / total) * 100;
    const severity = pct >= 60 ? "info" : "warning";
    warnings.push({
      code: "NO_PROTOCOL",
      severity,
      message:
        pct >= 60
          ? `${withoutProtocol} nota(s) sem protocolo (${Math.round(pct)}% do lote). Incidência excepcional — revise parser/origem antes de tratar como problema fiscal em massa.`
          : `${withoutProtocol} nota(s) sem protocolo de autorização (revisão recomendada; XMLs sem nfeProc podem ser legítimos conforme a origem).`,
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

  const recommendations: string[] = [];
  if (score < 70) recommendations.push("Revise XMLs inválidos e reexporte o lote no SIEG se necessário.");
  if (duplicateCount) recommendations.push("Remova duplicatas antes de consolidar apurações.");
  if (itemsWithoutNcm || itemsWithoutCfop)
    recommendations.push("Complete NCM/CFOP nos itens para análises fiscais mais precisas.");
  if (outsidePeriod) recommendations.push("Confirme o mês/ano informado no upload do lote.");
  if (!recommendations.length) recommendations.push("Lote saudável. Pronto para exportação e análise.");

  const values = documents.map((d) => d.totalValue || 0).filter((v) => v > 0);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const valueOutliers = values.filter((v) => avg > 0 && (v > avg * 5 || v < avg * 0.05)).length;

  return {
    score,
    breakdown: {
      xmlValidity: Math.round(xmlValidity),
      essentialFields: Math.round(essentialFields),
      duplicates: Math.round(duplicates),
      dateConsistency: Math.round(dateScore),
      valueConsistency: Math.round(valueScore),
      itemCompleteness: Math.round(itemCompleteness),
      fiscalIdentification: Math.round(fiscalIdentification),
    },
    warnings,
    recommendations,
    metrics: {
      validXmlPct: Math.round(validXmlPct),
      typeDistribution,
      missingEssential,
      topMissingFields,
      topFilledFields,
      topCfop: rankCounts(items.map((i) => i.cfop)),
      topNcm: rankCounts(items.map((i) => i.ncm)),
      topEmitters,
      topReceivers,
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
