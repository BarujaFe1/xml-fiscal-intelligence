export type { FiscalObligationPlugin, ObligationContext } from "@/modules/obligations/core/types";
export { efdIcmsIpiPlugin, EFD_ICMS_IPI_LAYOUT_2026 } from "@/modules/obligations/efd-icms-ipi/plugin";
export { buildObligationContextFromBatch } from "@/modules/obligations/efd-icms-ipi/from-batch";
export { normalizeNFeItemTax, normalizeIcmsTot } from "@/modules/obligations/efd-icms-ipi/tax/normalize-nfe-tax";

/** Stubs for future plugins — registered but not generating. */
export const obligationRegistry = {
  "efd-icms-ipi": "active",
  "efd-contribuicoes": "stub",
  ecd: "stub",
  ecf: "stub",
  reinf: "stub",
} as const;
