/**
 * Validação offline de EFD ICMS/IPI (leiaute 020).
 * Re-exporta o validador versionado por leiaute. Não substitui o PVA oficial.
 */
export {
  validateEfdOffline,
  type OfflineValidationInput,
  type OfflineValidationIssue,
  type ValidationContext,
  type SpedFieldDefinition,
  type SpedRecordDefinition,
  RECORDS,
  getRecordDef,
  BLOCK_ORDER,
  blockOf,
} from "../layouts/020";
