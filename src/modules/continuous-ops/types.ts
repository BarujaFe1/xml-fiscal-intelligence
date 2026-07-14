/**
 * Operação contínua — Fase 10 tipos.
 */

import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { ErpFieldMap, ErpImportPreview } from "@/modules/ops/erp-generic";

export type ErpVendorId =
  | "pilot_synth"
  | "totvs_placeholder"
  | "sap_placeholder"
  | "senior_placeholder"
  | "omie_placeholder"
  /** Fase 12 — live só com XFI_ALLOW_LIVE_ERP + secrets válidos em env */
  | "omie_live_pilot"
  /** Fase 14 — 2º vendor live gated */
  | "totvs_live_pilot"
  /** Fase 17 — 3º vendor live gated */
  | "sap_live_pilot";

export type ErpAdapterContract = {
  vendorId: ErpVendorId;
  displayName: string;
  /** Sempre true até NDA/contrato real assinado */
  ndaRequired: boolean;
  /** Nunca true sem secrets fora do git + fixtures */
  liveConnectionEnabled: boolean;
  maturity: "planned" | "development" | "internal_beta";
  domains: Array<"ledger_accounts" | "ledger_entries" | "contrib_entries" | "generic">;
  defaultFieldMap: ErpFieldMap[];
  notes: string[];
};

export type ErpNamedAdapter = ErpAdapterContract & {
  previewCsv(csv: string, domain: ErpImportPreview["domain"]): ErpImportPreview;
  /** Fixture sintética — zero dados reais de cliente */
  syntheticFixtureCsv(): string;
};

export type CompanyScopeFilter = {
  workspaceId: string;
  companyId?: string;
  establishmentId?: string;
};

export type QuotaPolicy = {
  workspaceId: string;
  maxGenerationsPerHour: number;
  maxApiCallsPerHour: number;
  updatedAt: string;
};

export type QuotaUsage = {
  generationsThisHour: number;
  apiCallsThisHour: number;
  hourBucket: string; // YYYY-MM-DDTHH
};

export type NtInboxStatus =
  | "identified"
  | "impact_assessment"
  | "draft_rule_set"
  | "awaiting_fixture"
  | "ready_for_review"
  | "rejected";

export type NtInboxItem = {
  id: string;
  workspaceId: string;
  sourceId: string;
  title: string;
  obligationId?: ObligationId | "platform" | "rtc";
  status: NtInboxStatus;
  impactManifest: string[];
  /** Nunca auto-activated */
  ruleSetActivated: false;
  draftRuleSetCode?: string;
  fixtureId?: string;
  reviewerId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type RehomologationCheck = {
  scenarioId: string;
  evidenceAgeDays: number;
  expired: boolean;
  nextDue: string; // ISO date
  action: "ok" | "retest_lab" | "export_section28";
};

export type ContinuousOpsMaturity = "development" | "internal_beta";
