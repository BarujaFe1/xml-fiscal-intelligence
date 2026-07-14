/**
 * Enterprise scale — Fase 12 tipos.
 * Sem selo SOC2/ISO; sem marketplace público open; sem production global.
 */

import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { OfficialProgramId } from "@/modules/obligations/core/maturity";

export type Soc2Family =
  | "CC1"
  | "CC2"
  | "CC3"
  | "CC5"
  | "CC6"
  | "CC7"
  | "CC8"
  | "A1"
  | "C1"
  | "PI1";

export type ControlMapping = {
  id: string;
  title: string;
  soc2Hints: Soc2Family[];
  /** Evidência no produto */
  evidenceRefs: string[];
  status: "implemented" | "partial" | "planned" | "out_of_scope";
  gapNotes?: string;
};

export type EvidenceBinderSection = {
  id: string;
  title: string;
  markdown: string;
};

export type EvidenceBinder = {
  generatedAt: string;
  sections: EvidenceBinderSection[];
  disclaimer: string;
};

export type MarketplaceListingStatus = "draft" | "published" | "retired";

/** Cenário sanitizado — sem CNPJ/XML/hashes sensíveis completos. */
export type MarketplaceListing = {
  id: string;
  tenantId: string;
  sourceWorkspaceId: string;
  title: string;
  obligationId: ObligationId;
  uf?: string;
  regime?: string;
  periodKeyPattern: string;
  layoutVersion: string;
  program: OfficialProgramId;
  /** Versão do golden pack associado */
  goldenPackVersion: string;
  status: MarketplaceListingStatus;
  /** hash truncado / fingerprint — nunca payload fiscal */
  contentFingerprint?: string;
  cellMaturityClaim: "official_validator_beta" | "validated_scope";
  publishedAt?: string;
  updatedAt: string;
  createdAt: string;
};

export type MarketplaceImportResult = {
  listingId: string;
  targetWorkspaceId: string;
  scenarioId: string;
  requiresRelab: true;
  statusForced: "lab_pending";
};

export type GoldenPackVersion = {
  packId: string;
  obligationId: ObligationId;
  uf?: string;
  version: string;
  fixtureId: string;
  notes?: string;
};

export type DpaStatus = "template_only" | "under_legal_review" | "signed";
export type SlaStatus = "draft" | "commercially_bound";

export type LegalCommercialStatus = {
  dpa: DpaStatus;
  sla: SlaStatus;
  /** Nunca true sem processo jurídico documentado */
  soc2Certified: false;
  iso27001Certified: false;
  notes: string[];
  updatedAt: string;
};

export type EnterpriseMaturity = "development" | "internal_beta" | "official_validator_beta";
