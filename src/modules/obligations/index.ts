export type { FiscalObligationPlugin, ObligationContext } from "@/modules/obligations/core/types";
export { efdIcmsIpiPlugin, EFD_ICMS_IPI_LAYOUT_2026, efdIcmsIpiCodVer, efdSanitize } from "@/modules/obligations/efd-icms-ipi/plugin";
export { getEfdUfPlugin, listRegisteredEfdUfs } from "@/modules/obligations/efd-icms-ipi/uf/registry";
export { auditXmlVsEfdTxt } from "@/modules/obligations/efd-icms-ipi/audit/xml-vs-efd";
export { isHomologationGradePvaRun } from "@/modules/obligations/efd-icms-ipi/pva/workflow";
export { efdContribuicoesPlugin, EFD_CONTRIB_LAYOUT_2026 } from "@/modules/obligations/efd-contribuicoes/plugin";
export { buildContribFromDomain } from "@/modules/obligations/efd-contribuicoes/from-domain";
export { isHomologationGradePgeRun } from "@/modules/obligations/efd-contribuicoes/homologation";
export { buildBlocoMDrafts } from "@/modules/contrib/bloco-m";
export { buildContribBooks, findIllicitCredits } from "@/modules/contrib/books";
export { assertRegimeForPeriod, CONTRIB_REGIME_PROFILES } from "@/modules/contrib/regimes";
export { parseContribMode, listSupportedModes } from "@/modules/contrib/modes";
export { cataloguedRuleImpacts, CONTRIB_RULE_SET_VERSIONS } from "@/modules/contrib/rule-sets";
export { validateRateio, applyRateio } from "@/modules/contrib/rateio";
export { simulateWithWithoutCredit, isContribSimulatorEnabled } from "@/modules/contrib/simulator";
export {
  parseDctfMitImportCsv,
  reconcileDctfMitVsContrib,
} from "@/modules/contrib/reconcile-dctf-mit";
export { ecdPlugin, ECD_LAYOUT_2026 } from "@/modules/obligations/ecd/plugin";
export { buildEcdFromLedger } from "@/modules/obligations/ecd/from-ledger";
export { entryIsBalanced, validateEntry, ledgerHasDemoAccounts } from "@/modules/accounting/rules";
export { buildDiario, buildTrialBalance, buildRazao } from "@/modules/accounting/books";
export {
  parseChartCsv,
  parseJournalCsv,
  parseLedgerJson,
} from "@/modules/accounting/import/csv";
export { parseEcdPriorI050 } from "@/modules/accounting/import/ecd-prior";
export { ecfPlugin, ECF_LAYOUT_2026 } from "@/modules/obligations/ecf/plugin";
export { buildEcfFromWorkspace } from "@/modules/obligations/ecf/from-workspace";
export { isHomologationGradeEcfRun } from "@/modules/obligations/ecf/homologation";
export { listOrphanAccounts, confirmMap } from "@/modules/ecf/mapper";
export { parseEcfPriorTxt } from "@/modules/ecf/recovery/ecf-prior";
export { recoverEcdFromLedger } from "@/modules/ecf/recovery/ecd";
export { diffElalur, emptyElalur, sumPartA } from "@/modules/ecf/elalur/model";
export { computeIrpjCsll, isEcfIrpjEngineEnabled } from "@/modules/ecf/irpj/engine";
export { reconcileEcdVsEcf } from "@/modules/ecf/reconcile";
export { parseReferentialCsv } from "@/modules/ecf/referential/catalog";
export { reinfPlugin, REINF_LAYOUT_2026 } from "@/modules/obligations/reinf/plugin";
export { REINF_CATALOG, listImplementedEvents } from "@/modules/obligations/reinf/catalog";
export {
  canTransition,
  assertTransition,
  type ReinfEventStatus,
} from "@/modules/obligations/reinf/lifecycle";
export { reconcileDctfVsReinf, parseDctfWebImportCsv } from "@/modules/obligations/reinf/dctf/reconcile";
export { stubLocalSign } from "@/modules/obligations/reinf/signer/local-agent";
export { submitReinfEvent, isReinfSubmitEnabled } from "@/modules/obligations/reinf/ws/client";
export {
  buildObligationContextFromBatch,
  filterDocumentsByPeriod,
} from "@/modules/obligations/efd-icms-ipi/from-batch";
export {
  suggestInformantFromDocuments,
  suggestInformantByCnpj,
  cnpjFromAccessKey,
  type InformantSuggestion,
} from "@/modules/obligations/efd-icms-ipi/suggest-informant";
export {
  type EfdGenerationStatus,
  type ReadinessStatus,
  type CloudMigrationStatus,
  EFD_GENERATION_STATUS_LABELS,
  isOfficialTransmissionClaim,
} from "@/modules/obligations/efd-icms-ipi/status";
export { resolveEfdLayoutGuide } from "@/modules/obligations/efd-icms-ipi/versions/resolve-layout";
export { normalizeNFeItemTax, normalizeIcmsTot } from "@/modules/obligations/efd-icms-ipi/tax/normalize-nfe-tax";
export {
  obligationRegistry,
  obligationPlugins,
  OBLIGATION_LABELS,
  OBLIGATION_BLURBS,
  OBLIGATION_IDS,
  OBLIGATION_SUPPORT_PROFILES,
  getSupportProfile,
  canOpenAssistant,
  getObligationPlugin,
  isObligationId,
  type ObligationId,
} from "@/modules/obligations/registry";
export {
  type ObligationMaturity,
  type ClosingCellStatus,
  OBLIGATION_MATURITY_LABELS,
  CLOSING_CELL_STATUS_LABELS,
} from "@/modules/obligations/core/maturity";
export {
  OFFICIAL_SOURCE_CATALOG,
  getOfficialSource,
  listOfficialSourcesByObligation,
} from "@/modules/obligations/core/sources/catalog";
export { runObligationPlugin } from "@/modules/obligations/core/pipe";
export { listCalendarRules } from "@/modules/obligations/core/workflows/calendar";
export { listCalendarCatalog, buildIcalReminder } from "@/modules/ops/calendar";
export { canApprove, approveTask, createClosingTask } from "@/modules/ops/sod";
export { createGeneration, diffGenerations } from "@/modules/ops/generations";
export { createEvidenceMeta } from "@/modules/ops/evidence";
export { sanitizeNotificationBody, buildNotification } from "@/modules/ops/notifications";
export {
  buildCommercialSupportMatrix,
  assertNoFalseProduction,
} from "@/modules/ops/commercial-matrix";
export { previewCsvImport, previewJsonImport } from "@/modules/ops/erp-generic";
export { PLATFORM_OPS_MATURITY } from "@/modules/ops/platform";
export { authenticateApiKey } from "@/modules/ops/api-auth";
export { RTC_MODULE_MATURITY, RTC_SUPPORT_PROFILE } from "@/modules/rtc/maturity";
export { resolveRtcPeriodSplit, assertContribModulePreserved } from "@/modules/rtc/period";
export { extractRtcFactsFromXml } from "@/modules/rtc/extract";
export { simulateRtcImpact, isRtcSimulatorEnabled } from "@/modules/rtc/simulator";
export { reconcileRtcVsContribCredits } from "@/modules/rtc/dual-contrib";
export { detectRtcReadiness } from "@/modules/rtc/readiness";
export { cataloguedRtcImpacts, RTC_RULE_SET_VERSIONS } from "@/modules/rtc/rule-sets";
export { isHomologationGradeRtcRun } from "@/modules/rtc/homologation";
export { HOMOLOGATION_PLAYBOOKS, getPlaybook } from "@/modules/homologation/playbooks";
export {
  createScenarioDraft,
  applyLabResult,
  markReviewed,
  cellMaturityFromScenario,
  diffScenarioMatrix,
} from "@/modules/homologation/scenarios";
export {
  buildTransmissionChecklist,
  transmissionAllowed,
  assertTransmitSoD,
  assertTransmitGates,
} from "@/modules/homologation/transmission";
export {
  isHomologationGradeGeneric,
  bridgeLabRunToEvidence,
  attachLabToScenario,
} from "@/modules/homologation/lab-bridge";
export { GOLDEN_PACKS, goldenCoverageReport } from "@/modules/homologation/golden-packs";
export {
  HOMOLOGATION_PLATFORM_MATURITY,
  SUPPORT_RUNBOOK_DONT_PROMISE,
  commercialValidatedScopeClaims,
} from "@/modules/homologation/platform";
export {
  activateRtcRuleSetWithFixture,
  assertStaticRtcRulesInactive,
} from "@/modules/homologation/rtc-activation";
export { listRegisteredAdapters, getAdapter, assertCatalogSafe } from "@/modules/continuous-ops/erp/registry";
export { runPilotGoldenPreview, pilotSynthAdapter } from "@/modules/continuous-ops/erp/pilot";
export {
  filterByCompanyScope,
  assertWithinQuota,
  bumpUsage,
  defaultQuotaPolicy,
} from "@/modules/continuous-ops/multi-company";
export {
  createNtInboxItem,
  advanceNtStatus,
  assertNeverAutoActivated,
  diffImpactManifest,
} from "@/modules/continuous-ops/nt-inbox";
export { checkRehomologation, exportSection28Pack } from "@/modules/continuous-ops/rehomologation";
export { CONTINUOUS_OPS_MATURITY, continuousOpsHealth } from "@/modules/continuous-ops/platform";
export {
  bindRole,
  canAct,
  assertCanAct,
  assertTransmitRbac,
  assertNtActivateRbac,
  assertExportSection28Rbac,
} from "@/modules/governance/rbac";
export {
  mergeAuditExport,
  auditExportToCsv,
  auditExportMarkdown,
  sanitizeAuditDetail,
  rowsFromClosingTasks,
  rowsFromTelemetry,
} from "@/modules/governance/audit-export";
export {
  seedDefaultRetention,
  createRetentionPolicy,
  isPastRetention,
} from "@/modules/governance/retention";
export { computeSlaSnapshot, DRAFT_SLA_TARGETS } from "@/modules/governance/sla";
export {
  createCampaign,
  buildCellDashboard,
  tryCompleteCampaign,
  PRIORITY_CAMPAIGN_SEEDS,
} from "@/modules/governance/campaigns";
export {
  GOVERNANCE_PLATFORM_MATURITY,
  governanceHealth,
  section28Phase11Report,
} from "@/modules/governance/platform";
export { requestNtActivationReview } from "@/modules/governance/nt-activate-gate";
export { denyLiveErpWithoutEnv, isLikelySecretPath } from "@/modules/governance/secrets-guard";
export {
  CONTROL_MATRIX,
  controlMatrixMarkdown,
  controlMatrixSummary,
} from "@/modules/enterprise/controls";
export {
  buildEvidenceBinder,
  binderToMarkdown,
  binderToZipBlob,
} from "@/modules/enterprise/evidence-binder";
export {
  publishScenarioListing,
  importListingWithRelab,
  listPublishedForTenant,
} from "@/modules/enterprise/marketplace";
export { listGoldenVersions } from "@/modules/enterprise/golden-versions";
export {
  createOmieLivePilotAdapter,
  runOmieLivePilotGolden,
} from "@/modules/enterprise/erp-live-pilot";
export {
  ENTERPRISE_PLATFORM_MATURITY,
  enterpriseHealth,
  section28Phase12Report,
} from "@/modules/enterprise/platform";
export {
  defaultLegalStatus,
  applyLegalMilestones,
} from "@/modules/enterprise/legal-status";
export {
  SCALE_PLATFORM_MATURITY,
  scaleHealth,
  section28Phase13Report,
} from "@/modules/scale/platform";
export { defaultDrTargets, executeDrDrill, createDrDrill } from "@/modules/scale/dr";
export { regionalHealthReport } from "@/modules/scale/regions";
export {
  quotaPolicyForPlan,
  listPlanCatalog,
  billingEnterpriseEnabled,
} from "@/modules/scale/billing-plans";
export { aggregateMeterSamples, recordMeterSample } from "@/modules/scale/metering";
export {
  createMassCampaign,
  buildCoverageDashboard,
  tryCompleteMassCampaign,
  aggregateSection28Campaign,
} from "@/modules/scale/mass-campaigns";
export {
  ECOSYSTEM_PLATFORM_MATURITY,
  ecosystemHealth,
  section28Phase14Report,
} from "@/modules/ecosystem/platform";
export {
  computeSloSnapshot,
  seedStagingApiStatusSamples,
  computeErrorBudget,
} from "@/modules/ecosystem/slo";
export { exportPrometheusText } from "@/modules/ecosystem/otel-hooks";
export {
  createPartnerInvite,
  acceptPartnerInvite,
  assertPartnerCannotTransmit,
} from "@/modules/ecosystem/partners";
export {
  createTotvsLivePilotAdapter,
  runTotvsLivePilotGolden,
} from "@/modules/ecosystem/totvs-live-pilot";
export {
  COMPLIANCE_PLATFORM_MATURITY,
  complianceHealth,
  section28Phase15Report,
} from "@/modules/compliance/platform";
export {
  buildCompliancePack,
  packToMarkdown,
  verifyPackHash,
} from "@/modules/compliance/pack";
export {
  createPrivacyRequest,
  fulfillEraseHonest,
  dataMapMarkdown,
} from "@/modules/compliance/lgpd";
export { t, normalizeLocale } from "@/modules/compliance/i18n";
export { periodKeyMonthly } from "@/modules/compliance/timezone";
export {
  assertNoForeignTaxEngine,
  JURISDICTION_BR,
} from "@/modules/compliance/jurisdiction";
export {
  GROWTH_PLATFORM_MATURITY,
  growthHealth,
  section28Phase16Report,
} from "@/modules/growth/platform";
export {
  submitPublicListing,
  importPublicListingWithRelab,
  moderatePublicListing,
  listApprovedPublic,
} from "@/modules/growth/public-marketplace";
export {
  answerGuidedAssist,
  detectsForbiddenTaxAsk,
  isGuidedAssistEnabled,
} from "@/modules/growth/guided-assist";
export {
  buildMobileClosingSummary,
  assertMobileReadOnly,
} from "@/modules/growth/mobile-readonly";
export {
  generateObligationLocal,
  readJsonOrTextError,
  type LocalEstablishmentInput,
  type LocalGenerateResult,
} from "@/modules/obligations/generate-local";
export {
  DEMO_ESTABLISHMENT,
  DEMO_BATCH_ID,
  fetchObligationDemo,
  type ObligationDemoPayload,
} from "@/modules/obligations/demo-fixtures";
