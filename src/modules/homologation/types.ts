/**
 * Homologação oficial — evidência por cenário (Fase 9).
 * Nunca sobe validated_scope/production sem pacote completo.
 */

import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { ObligationMaturity, OfficialProgramId } from "@/modules/obligations/core/maturity";

export type HomologationPlaybookStep =
  | "fixture_synthetic"
  | "generate"
  | "run_official_program"
  | "import_result"
  | "vault_evidence"
  | "human_review"
  | "matrix_cell";

export type HomologationPlaybook = {
  id: string;
  obligationId: ObligationId;
  program: OfficialProgramId;
  title: string;
  steps: HomologationPlaybookStep[];
  notes: string[];
};

export type ScenarioPackageStatus =
  | "draft"
  | "lab_pending"
  | "evidence_partial"
  | "homologation_grade"
  | "reviewed"
  | "validated_scope_ready"
  /** Nunca auto — exige promoção explícita com pacote */
  | "blocked_missing_lab";

export type ValidatedScenario = {
  id: string;
  workspaceId: string;
  obligationId: ObligationId;
  regime?: string;
  uf?: string;
  periodKey: string;
  layoutVersion: string;
  program: OfficialProgramId;
  programVersion?: string;
  contentHash?: string;
  generationId?: string;
  evidenceId?: string;
  homologationGrade: boolean;
  status: ScenarioPackageStatus;
  /** Maturidade pretendida da CÉLULA (não da obrigação inteira) */
  cellMaturityTarget: Extract<
    ObligationMaturity,
    "official_validator_beta" | "validated_scope"
  >;
  reviewerId?: string;
  reviewedAt?: string;
  section28Notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type TransmissionChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  ok: boolean;
  detail?: string;
};

export type ApiKeyAuditEvent = {
  id: string;
  keyId: string;
  path: string;
  at: string;
  ok: boolean;
  note?: string;
};

export type GoldenPack = {
  id: string;
  obligationId: ObligationId;
  fixtureId: string;
  description: string;
  /** Test file / suite hint */
  testHint: string;
  required: boolean;
};

export type HomologationPlatformMaturity = "development" | "internal_beta";
