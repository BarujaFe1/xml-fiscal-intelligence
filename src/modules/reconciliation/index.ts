/**
 * Reconciliation foundation — no fake ERP integrations.
 * Compares fiscal documents within a batch for unmatched / value gaps.
 */

import type { DocumentSummary } from "@/types";

export type ReconciliationIssue = {
  id: string;
  kind: "unmatched_cte" | "unmatched_nfe_key" | "value_gap" | "missing_pair";
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  documentIds: string[];
  factors: string[];
};

export function reconcileBatchDocuments(input: {
  documents: DocumentSummary[];
  linkedNfeKeysFromCte: Set<string>;
}): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const nfeByKey = new Map<string, DocumentSummary>();
  for (const d of input.documents) {
    if ((d.documentType === "NFE" || d.documentType === "NFCE") && d.accessKey) {
      nfeByKey.set(d.accessKey, d);
    }
  }

  for (const key of input.linkedNfeKeysFromCte) {
    if (!nfeByKey.has(key)) {
      issues.push({
        id: `unmatched_key_${key.slice(0, 12)}`,
        kind: "unmatched_nfe_key",
        severity: "warning",
        title: "CT-e referencia NF-e ausente no lote",
        description: `Chave ${key.slice(0, 20)}… não encontrada entre documentos do lote.`,
        documentIds: [],
        factors: ["chave referenciada no CT-e", "NF-e não presente no mesmo lote"],
      });
    }
  }

  for (const d of input.documents.filter((x) => x.documentType === "CTE")) {
    // If CT-e has no protocol and no linked keys, flag review
    if (!d.protocol) {
      issues.push({
        id: `cte_review_${d.id}`,
        kind: "missing_pair",
        severity: "info",
        title: "CT-e sem protocolo — revisar conciliação",
        description: `${d.number || d.fileName}: conferir origem do XML e vínculos.`,
        documentIds: [d.id],
        factors: ["documento CT-e", "protocolo ausente"],
      });
    }
  }

  // Same emitter+number different keys → value gap candidate
  const byEmitterNumber = new Map<string, DocumentSummary[]>();
  for (const d of input.documents) {
    if (!d.emitterDoc || !d.number) continue;
    const k = `${d.emitterDoc}|${d.number}|${d.series || ""}`;
    const g = byEmitterNumber.get(k) || [];
    g.push(d);
    byEmitterNumber.set(k, g);
  }
  for (const [, group] of byEmitterNumber) {
    if (group.length < 2) continue;
    const values = group.map((g) => g.totalValue ?? 0);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max - min > 0.009) {
      issues.push({
        id: `value_gap_${group[0]!.id}`,
        kind: "value_gap",
        severity: "warning",
        title: "Mesmo número com valores divergentes",
        description: `Diferença de R$ ${(max - min).toFixed(2)} entre documentos do mesmo emitente/número.`,
        documentIds: group.map((g) => g.id),
        factors: ["mesmo emitente", "mesmo número", "valor incompatível"],
      });
    }
  }

  return issues;
}

/** Explain relationship confidence factors from evidence bag. */
export function explainConfidence(evidence?: Record<string, unknown>): string[] {
  if (!evidence) return ["sem fatores explícitos"];
  const factors: string[] = [];
  if (evidence.accessKey) factors.push("chave de acesso referenciada");
  if (evidence.xmlHash) factors.push("hash XML idêntico");
  if (evidence.via) factors.push(`via ${String(evidence.via)}`);
  if (evidence.sameCnpj) factors.push("mesmo CNPJ");
  if (evidence.nearDate) factors.push("data próxima");
  if (evidence.valueCompatible) factors.push("valor compatível");
  if (!factors.length) {
    for (const [k, v] of Object.entries(evidence)) {
      factors.push(`${k}=${String(v).slice(0, 40)}`);
    }
  }
  return factors;
}
