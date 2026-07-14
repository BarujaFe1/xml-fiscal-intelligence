/**
 * UF-specific EFD ICMS/IPI helpers.
 * Never invent COD_REC or adjustment codes — only tables cited with officialSourceId.
 */

export type UfIcmsCodRecEntry = {
  code: string;
  label: string;
  /** Official source catalog id */
  sourceId: string;
  notes?: string;
};

export type UfAdjustmentCodeEntry = {
  code: string;
  label: string;
  sourceId: string;
};

export type EfdUfPlugin = {
  uf: string;
  /** Empty until filled from official state tables. */
  icmsCodRecTable: UfIcmsCodRecEntry[];
  adjustmentCodes: UfAdjustmentCodeEntry[];
  /** Resolve COD_REC for E116 when context.icmsCodRec empty — returns undefined if no official row. */
  suggestIcmsCodRec?(ctx: { periodEnd: string }): string | undefined;
};

export function emptyUfPlugin(uf: string): EfdUfPlugin {
  return {
    uf: uf.toUpperCase(),
    icmsCodRecTable: [],
    adjustmentCodes: [],
  };
}
