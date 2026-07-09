export type DocumentType = "NFE" | "CTE" | "NFSE" | "UNKNOWN";

export type ParseStatus = "ok" | "partial" | "error";

export type InferredType = "string" | "number" | "date" | "boolean" | "empty";

export type BatchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "partial";

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  workspaceId: string;
  name: string;
  cnpjLabel?: string;
  month?: number;
  year?: number;
  uploadedFileName: string;
  status: BatchStatus;
  totalFiles: number;
  totalXml: number;
  validXml: number;
  invalidXml: number;
  nfeCount: number;
  cteCount: number;
  nfseCount: number;
  unknownCount: number;
  duplicateCount: number;
  totalValue: number;
  healthScore: number;
  progress: number;
  progressMessage: string;
  createdAt: string;
  updatedAt: string;
  quality?: QualityReport;
}

export interface DocumentSummary {
  id: string;
  workspaceId: string;
  batchId: string;
  documentType: DocumentType;
  schemaVersion?: string;
  fileName: string;
  accessKey?: string;
  number?: string;
  series?: string;
  model?: string;
  issueDate?: string;
  authorizationDate?: string;
  emitterDoc?: string;
  emitterName?: string;
  emitterCity?: string;
  emitterUf?: string;
  receiverDoc?: string;
  receiverName?: string;
  receiverCity?: string;
  receiverUf?: string;
  serviceCity?: string;
  totalValue?: number;
  productsValue?: number;
  servicesValue?: number;
  freightValue?: number;
  discountValue?: number;
  taxValue?: number;
  status?: string;
  protocol?: string;
  rawXmlPath?: string;
  rawJson: Record<string, unknown>;
  flattenedJson: Record<string, string | number | boolean | null>;
  parseStatus: ParseStatus;
  parseErrors: string[];
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  workspaceId: string;
  batchId: string;
  documentId: string;
  documentType: DocumentType;
  itemNumber: number;
  code?: string;
  description?: string;
  ncm?: string;
  cfop?: string;
  unit?: string;
  quantity?: number;
  unitValue?: number;
  totalValue?: number;
  discountValue?: number;
  taxJson: Record<string, unknown>;
  rawJson: Record<string, unknown>;
  flattenedJson: Record<string, string | number | boolean | null>;
}

export interface DocumentField {
  id: string;
  workspaceId: string;
  batchId: string;
  documentId: string;
  documentType: DocumentType;
  pathOriginal: string;
  pathNormalized: string;
  fieldName: string;
  valueText?: string;
  valueNumber?: number;
  valueDate?: string;
  inferredType: InferredType;
  isEmpty: boolean;
}

export interface ParseError {
  id: string;
  workspaceId: string;
  batchId: string;
  fileName: string;
  errorType: string;
  errorMessage: string;
  rawSnippet?: string;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  workspaceId: string;
  batchId: string;
  exportType: string;
  filePath: string;
  status: "ready" | "failed";
  createdAt: string;
}

export interface QualityWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  count: number;
}

export interface QualityReport {
  score: number;
  breakdown: {
    xmlValidity: number;
    essentialFields: number;
    duplicates: number;
    dateConsistency: number;
    valueConsistency: number;
    itemCompleteness: number;
    fiscalIdentification: number;
  };
  warnings: QualityWarning[];
  recommendations: string[];
  metrics: {
    validXmlPct: number;
    typeDistribution: Record<string, number>;
    missingEssential: Record<string, number>;
    topMissingFields: Array<{ path: string; missingPct: number }>;
    topFilledFields: Array<{ path: string; filledPct: number }>;
    topCfop: Array<{ value: string; count: number }>;
    topNcm: Array<{ value: string; count: number }>;
    topEmitters: Array<{ doc: string; name: string; total: number; count: number }>;
    topReceivers: Array<{ doc: string; name: string; total: number; count: number }>;
    topMunicipalities: Array<{ value: string; count: number }>;
    valueOutliers: number;
    itemSumDivergences: number;
    zeroMonetary: number;
    invalidCnpjFormat: number;
    withoutKey: number;
    withoutProtocol: number;
    itemsWithoutNcm: number;
    itemsWithoutCfop: number;
    outsidePeriod: number;
  };
}

export interface BatchStore {
  batch: Batch;
  documents: DocumentSummary[];
  items: DocumentItem[];
  fields: DocumentField[];
  errors: ParseError[];
  exports: ExportRecord[];
}

export interface SearchResult {
  kind: "document" | "item" | "field";
  documentId: string;
  batchId: string;
  documentType: DocumentType;
  title: string;
  subtitle?: string;
  matchedField?: string;
  preview?: string;
  totalValue?: number;
  issueDate?: string;
  emitterName?: string;
  receiverName?: string;
}

export interface ProcessReport {
  totalFiles: number;
  totalXml: number;
  validXml: number;
  invalidXml: number;
  byType: Record<DocumentType, number>;
  duplicates: number;
  withoutKey: number;
  unknownStructure: number;
  errors: Array<{ fileName: string; message: string }>;
}
