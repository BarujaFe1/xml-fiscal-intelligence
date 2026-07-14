export type { FiscalObligationPlugin, ObligationContext } from "@/modules/obligations/core/types";
export { efdIcmsIpiPlugin, EFD_ICMS_IPI_LAYOUT_2026, efdIcmsIpiCodVer, efdSanitize } from "@/modules/obligations/efd-icms-ipi/plugin";
export { efdContribuicoesPlugin, EFD_CONTRIB_LAYOUT_2026 } from "@/modules/obligations/efd-contribuicoes/plugin";
export { ecdPlugin, ECD_LAYOUT_2026 } from "@/modules/obligations/ecd/plugin";
export { ecfPlugin, ECF_LAYOUT_2026 } from "@/modules/obligations/ecf/plugin";
export { reinfPlugin, REINF_LAYOUT_2026 } from "@/modules/obligations/reinf/plugin";
export { buildObligationContextFromBatch } from "@/modules/obligations/efd-icms-ipi/from-batch";
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
  getObligationPlugin,
  isObligationId,
  type ObligationId,
} from "@/modules/obligations/registry";
export { runObligationPlugin } from "@/modules/obligations/core/pipe";
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
