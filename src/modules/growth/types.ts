/**
 * Growth — Fase 16: marketplace público · guided assist · mobile read-only.
 * Sem inventar tributos · sem production global · sem marketplace irrestrito.
 */

import type { MarketplaceListing } from "@/modules/enterprise/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { ObligationMaturity, OfficialProgramId } from "@/modules/obligations/core/maturity";

export type PublicListingModeration =
  | "pending_review"
  | "approved"
  | "rejected"
  | "retired";

export type PublicMarketplaceListing = {
  id: string;
  /** Listing tenant de origem (sanitizado) */
  sourceListingId: string;
  sourceTenantId: string;
  title: string;
  obligationId: ObligationId;
  uf?: string;
  regime?: string;
  layoutVersion: string;
  program: OfficialProgramId;
  periodKeyPattern: string;
  goldenPackVersion: string;
  cellMaturityClaim: MarketplaceListing["cellMaturityClaim"];
  contentFingerprint?: string;
  moderation: PublicListingModeration;
  abuseFlags: string[];
  compliancePackHashRef?: string;
  publishedAt?: string;
  moderatedAt?: string;
  moderatorId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceRateLimit = {
  tenantId: string;
  publishesThisHour: number;
  importsThisHour: number;
  hourBucket: string;
  maxPublishesPerHour: number;
  maxImportsPerHour: number;
};

export type GuidedAssistAnswer = {
  ok: boolean;
  blocked: boolean;
  reason?: string;
  nextSteps: string[];
  playbookId?: string;
  disclaimer: string;
  /** Fase 17 — fontes oficiais citadas (grounding) */
  sourceIds?: string[];
};

export type MobileClosingSummary = {
  workspaceId: string;
  cards: number;
  readyPctEstimate: number;
  alerts: string[];
  readOnly: true;
  canGenerate: false;
  canTransmit: false;
};

export type GrowthMaturity = "development" | "internal_beta" | "official_validator_beta";

export type MaturityGapHint = {
  obligationId: ObligationId;
  maturity: ObligationMaturity;
  gaps: string[];
};
