import { v4 as uuidv4 } from "uuid";

export type AnalysisGeneration = {
  id: string;
  batchId: string;
  workspaceId: string;
  parserVersion: string;
  schemaVersion: string;
  ruleSetVersion: string;
  qualityFormulaVersion: string;
  generatedAt: string;
  parentGenerationId?: string;
  documentCount: number;
  findingCount: number;
  note?: string;
};

export const PARSER_RUNTIME_VERSION = "xml-fiscal-parser@0.2.0";
export const RULE_SET_RUNTIME_VERSION = "audit-core@0.2.0";
export const SCHEMA_RUNTIME_VERSION = "document-summary@1";

export function createAnalysisGeneration(input: {
  batchId: string;
  workspaceId: string;
  documentCount: number;
  findingCount: number;
  parentGenerationId?: string;
  qualityFormulaVersion: string;
  note?: string;
}): AnalysisGeneration {
  return {
    id: uuidv4(),
    batchId: input.batchId,
    workspaceId: input.workspaceId,
    parserVersion: PARSER_RUNTIME_VERSION,
    schemaVersion: SCHEMA_RUNTIME_VERSION,
    ruleSetVersion: RULE_SET_RUNTIME_VERSION,
    qualityFormulaVersion: input.qualityFormulaVersion,
    generatedAt: new Date().toISOString(),
    parentGenerationId: input.parentGenerationId,
    documentCount: input.documentCount,
    findingCount: input.findingCount,
    note: input.note,
  };
}
