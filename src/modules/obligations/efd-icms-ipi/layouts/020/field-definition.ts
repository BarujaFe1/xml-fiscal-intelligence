/**
 * Tipos de definição de leiaute SPED (leiaute 020 / Guia 3.2.2).
 * Usados pelo validador offline para checar contagem, tipo, enumeração e
 * obrigatoriedade dos campos ANTES da validação no PVA oficial.
 */

export type SpedFieldType = "C" | "N";

export interface ValidationContext {
  activityCode?: string; // IND_ATIV
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string; // YYYY-MM-DD
}

export interface SpedFieldDefinition {
  position: number; // 1-based, incluindo REG
  name: string;
  type: SpedFieldType;
  required?: boolean | ((ctx: ValidationContext) => boolean);
  maxLength?: number;
  scale?: number;
  allowedValues?: readonly string[];
}

export interface SpedRecordDefinition {
  code: string;
  level: number;
  parent?: string;
  fields: readonly SpedFieldDefinition[];
  minOccurrences?: number;
  maxOccurrences?: number;
}

export interface OfflineValidationIssue {
  severity: "error" | "warning";
  recordCode: string;
  field?: string;
  line?: number;
  rule: string;
  message: string;
  sourceDocument?: string;
}

/** Infere o tipo de campo a partir do nome (heurística; não substitui definição explícita). */
export function inferFieldType(name: string): SpedFieldType {
  if (/^(VL_|ALIQ_|QTD|QUANT|QTDE|VLR|IND_APUR|NUM_)/i.test(name)) return "N";
  return "C";
}
