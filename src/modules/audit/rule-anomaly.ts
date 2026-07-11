import type { AuditFinding, FindingSeverity } from "@/types";
import { v4 as uuidv4 } from "uuid";

export interface RuleAnomaly {
  code: string;
  count: number;
  totalDocuments: number;
  percentage: number;
  suggestion: string;
}

/**
 * When a single rule hits an extraordinary share of the batch, prefer grouping
 * and parser/origin review over thousands of identical cards.
 */
export function detectRuleAnomalies(
  findings: AuditFinding[],
  totalDocuments: number,
  thresholdPct = 60,
): RuleAnomaly[] {
  if (!totalDocuments) return [];
  const byCode = new Map<string, number>();
  for (const f of findings) {
    byCode.set(f.code, (byCode.get(f.code) || 0) + 1);
  }
  const out: RuleAnomaly[] = [];
  for (const [code, count] of byCode) {
    const percentage = (count / totalDocuments) * 100;
    if (percentage < thresholdPct) continue;
    out.push({
      code,
      count,
      totalDocuments,
      percentage: Math.round(percentage),
      suggestion:
        code === "NO_PROTOCOL"
          ? "Incidência excepcional de ausência de protocolo. Revise o parser (infProt/nProt) e a origem dos XMLs (nfeProc completo vs. apenas NFe) antes de tratar todos como problema fiscal."
          : `Regra ${code} afeta ${Math.round(percentage)}% do lote. Considere amostragem, revisão da regra ou da origem dos dados.`,
    });
  }
  return out;
}

export function groupFindingsByCode(findings: AuditFinding[]): Map<
  string,
  { code: string; title: string; severity: FindingSeverity; count: number; sampleIds: string[] }
> {
  const map = new Map<
    string,
    { code: string; title: string; severity: FindingSeverity; count: number; sampleIds: string[] }
  >();
  for (const f of findings) {
    const cur = map.get(f.code) || {
      code: f.code,
      title: f.title,
      severity: f.severity,
      count: 0,
      sampleIds: [],
    };
    cur.count += 1;
    if (cur.sampleIds.length < 5 && f.documentId) cur.sampleIds.push(f.documentId);
    map.set(f.code, cur);
  }
  return map;
}

/** Downgrade mass NO_PROTOCOL findings when anomaly threshold is hit. */
export function applyProtocolAnomalyPolicy(
  findings: AuditFinding[],
  totalDocuments: number,
): { findings: AuditFinding[]; anomalies: RuleAnomaly[] } {
  const anomalies = detectRuleAnomalies(findings, totalDocuments, 60);
  const protocolAnomaly = anomalies.find((a) => a.code === "NO_PROTOCOL");
  if (!protocolAnomaly) return { findings, anomalies };

  const sample = findings.find((f) => f.code === "NO_PROTOCOL");
  if (!sample) return { findings, anomalies };

  const collapsed: AuditFinding[] = [];
  let keptSample = 0;
  for (const f of findings) {
    if (f.code !== "NO_PROTOCOL") {
      collapsed.push(f);
      continue;
    }
    if (keptSample < 3) {
      collapsed.push({
        ...f,
        severity: "info",
        title: "Sem protocolo (amostra — anomalia de lote)",
        recommendation:
          "Alta incidência no lote. Revise parser/origem; não trate automaticamente como erro fiscal em massa.",
      });
      keptSample += 1;
    }
  }
  collapsed.unshift({
    id: uuidv4(),
    workspaceId: sample.workspaceId,
    batchId: sample.batchId,
    status: "open",
    createdAt: new Date().toISOString(),
    category: sample.category,
    code: "NO_PROTOCOL_ANOMALY",
    severity: "warning",
    title: "Anomalia: ausência de protocolo em massa",
    description: protocolAnomaly.suggestion,
    evidence: {
      count: protocolAnomaly.count,
      percentage: protocolAnomaly.percentage,
      totalDocuments,
    },
    recommendation: "Inspecione nfeProc/protNFe/infProt e a fonte SIEG/export antes de escalar.",
  });
  return { findings: collapsed, anomalies };
}
