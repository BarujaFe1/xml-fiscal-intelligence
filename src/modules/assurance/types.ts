/**
 * Assurance — Fase 17: SOC2 prep · grounding · ERP live #3.
 * Sem emitir relatório SOC2 · sem inventar tributos · sem production global.
 */

export type Soc2ReadinessStatus = "open" | "done" | "waived";

export type Soc2ReadinessItem = {
  id: string;
  title: string;
  status: Soc2ReadinessStatus;
  evidenceRef?: string;
  waiverRationale?: string;
};

export type StatementOfApplicabilityRow = {
  controlId: string;
  applicable: boolean;
  implemented: boolean;
  notes: string;
};

export type OfficialSnippet = {
  sourceId: string;
  title: string;
  url: string;
  /** Texto aprovado — sem alíquotas/vencimentos inventados */
  snippet: string;
  obligation?: string;
};

export type GroundedAssistAnswer = {
  ok: boolean;
  blocked: boolean;
  reason?: string;
  nextSteps: string[];
  playbookId?: string;
  disclaimer: string;
  sourceIds: string[];
  citations: Array<{ sourceId: string; title: string; url: string }>;
};

export type AssuranceMaturity = "development" | "internal_beta" | "official_validator_beta";
