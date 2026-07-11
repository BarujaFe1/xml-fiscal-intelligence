import type { FindingSeverity } from "@/types";

/**
 * Versioned audit rule catalog — objective rules only invent nothing.
 * Nature "heuristic" must never be presented as legal certainty.
 */
export interface AuditRuleDefinition {
  id: string;
  code: string;
  name: string;
  category: string;
  severity: FindingSeverity;
  nature: "objective" | "heuristic" | "ai_suggestion";
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  jurisdiction?: string;
  sourceId?: string;
  confidence?: number;
  blocking?: boolean;
  requiresReview?: boolean;
}

export const AUDIT_RULE_CATALOG: AuditRuleDefinition[] = [
  {
    id: "rule_no_access_key",
    code: "NO_ACCESS_KEY",
    name: "Documento sem chave de acesso",
    category: "identificacao",
    severity: "warning",
    nature: "objective",
    version: "2026.1",
    effectiveFrom: "2024-01-01",
    jurisdiction: "BR",
    requiresReview: true,
  },
  {
    id: "rule_no_protocol",
    code: "NO_PROTOCOL",
    name: "Sem protocolo de autorização",
    category: "protocolo",
    severity: "info",
    nature: "objective",
    version: "2026.2",
    effectiveFrom: "2024-01-01",
    jurisdiction: "BR",
    requiresReview: true,
    confidence: 0.7,
  },
  {
    id: "rule_no_protocol_anomaly",
    code: "NO_PROTOCOL_ANOMALY",
    name: "Anomalia: ausência de protocolo em massa",
    category: "protocolo",
    severity: "warning",
    nature: "heuristic",
    version: "2026.2",
    effectiveFrom: "2026-01-01",
    jurisdiction: "BR",
    requiresReview: true,
    confidence: 0.9,
  },
  {
    id: "rule_invalid_emitter",
    code: "INVALID_EMITTER_DOC",
    name: "CNPJ/CPF emitente inválido",
    category: "cadastro",
    severity: "warning",
    nature: "objective",
    version: "2026.1",
    effectiveFrom: "2024-01-01",
    jurisdiction: "BR",
  },
];

export function getAuditRuleByCode(code: string): AuditRuleDefinition | undefined {
  return AUDIT_RULE_CATALOG.find((r) => r.code === code);
}

export function resolveAuditRuleVersion(
  code: string,
  competenceIsoDate?: string,
): AuditRuleDefinition | undefined {
  const candidates = AUDIT_RULE_CATALOG.filter((r) => r.code === code);
  if (!candidates.length) return undefined;
  if (!competenceIsoDate) return candidates[candidates.length - 1];
  const t = competenceIsoDate.slice(0, 10);
  return (
    candidates.find(
      (r) => r.effectiveFrom <= t && (!r.effectiveTo || r.effectiveTo >= t),
    ) || candidates[candidates.length - 1]
  );
}
