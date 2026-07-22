import type { DocumentType, FindingSeverity, ParseStatus } from "@/types";

export const EXPORT_DATASET_SCHEMA = "2.0.0" as const;

export type ExportPrivacyProfile = "operational_full" | "shareable_masked" | "custom";

export type ExportJsonProfile = "compact" | "audit_full" | "jsonl" | "flat";

export type ExportCsvProfile = "excel_pt_br" | "integration";

export type ExportPrivacyPolicy = {
  profile: ExportPrivacyProfile;
  maskAccessKeys: boolean;
  maskPartyDocs: boolean;
  includeAddresses: boolean;
  includeRawStructures: boolean;
  note: string;
};

export type ExportSelectionSnapshot = {
  requestedIds: string[];
  foundIds: string[];
  missingIds: string[];
  filters: Record<string, unknown>;
  snappedAt: string;
};

export type ExportDocument = {
  id: string;
  documentType: DocumentType;
  fileName: string;
  accessKey?: string;
  number?: string;
  series?: string;
  model?: string;
  issueDate?: string;
  authorizationDate?: string;
  emitterDoc?: string;
  emitterName?: string;
  emitterUf?: string;
  receiverDoc?: string;
  receiverName?: string;
  receiverUf?: string;
  natureOperation?: string;
  cfopMain?: string;
  /** Canonical money string, 2 dp */
  totalValue: string;
  productsValue: string;
  servicesValue: string;
  freightValue: string;
  discountValue: string;
  taxValue: string;
  status?: string;
  protocol?: string;
  parseStatus: ParseStatus;
  parseErrors: string[];
  qualityScore?: number;
  isDuplicate?: boolean;
  etiquetaCbs: "sim" | "nao";
  somaCbs: string;
  etiquetaIbs: "sim" | "nao";
  somaIbs: string;
  /** Only in audit_full */
  flattenedJson?: Record<string, string | number | boolean | null>;
  rawJson?: Record<string, unknown>;
};

export type ExportItem = {
  id: string;
  documentId: string;
  documentType: DocumentType;
  itemNumber: number;
  code?: string;
  description?: string;
  ncm?: string;
  cest?: string;
  cfop?: string;
  cst?: string;
  csosn?: string;
  unit?: string;
  quantity?: string;
  unitValue: string;
  totalValue: string;
  discountValue: string;
  accessKey?: string;
  noteNumber?: string;
  emitterName?: string;
  taxJson?: Record<string, unknown>;
  flattenedJson?: Record<string, string | number | boolean | null>;
};

export type ExportFinding = {
  id: string;
  documentId?: string;
  severity: FindingSeverity;
  category: string;
  code: string;
  title: string;
  description: string;
  status: string;
};

export type ExportRelationship = {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  relationshipType: string;
  confidenceScore: number;
};

export type RawXmlAvailability = {
  documentId: string;
  available: boolean;
  fileName?: string;
  xmlHash?: string;
};

export type ExportSummary = {
  batchId: string;
  batchName: string;
  uploadedFileName: string;
  informedCompetence?: string;
  realPeriodMin?: string;
  realPeriodMax?: string;
  competenceMismatch: boolean;
  outsideCompetenceCount: number;
  documentCount: number;
  itemCount: number;
  findingCount: number;
  relationshipCount: number;
  xmlAvailableCount: number;
  xmlMissingCount: number;
  parseErrorCount: number;
  duplicateCount: number;
  byType: Record<string, number>;
  byParseStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  /** Exact money total as canonical decimal string */
  totalValue: string;
  healthScore: number | null;
};

export type ExportManifestV2 = {
  schemaVersion: typeof EXPORT_DATASET_SCHEMA;
  generationId: string;
  generatedAt: string;
  timezone: string;
  appVersion: string;
  buildCommit: string;
  workspaceId: string;
  batchId: string;
  batchName: string;
  filters: Record<string, unknown>;
  privacy: ExportPrivacyPolicy;
  informedCompetence?: string;
  realPeriodMin?: string;
  realPeriodMax?: string;
  preflightWarnings: string[];
  counts: {
    requested: number;
    documents: number;
    items: number;
    findings: number;
    relationships: number;
    xmlAvailable: number;
    xmlMissing: number;
    missingIds: number;
  };
  totals: {
    totalValue: string;
  };
  parserVersions: string[];
  disclaimer: string;
  emptyReason?: string | null;
};

export type ExportDatasetV2 = {
  schemaVersion: typeof EXPORT_DATASET_SCHEMA;
  selection: ExportSelectionSnapshot;
  privacy: ExportPrivacyPolicy;
  summary: ExportSummary;
  documents: ExportDocument[];
  items: ExportItem[];
  findings: ExportFinding[];
  relationships: ExportRelationship[];
  rawXmlAvailability: RawXmlAvailability[];
  manifest: ExportManifestV2;
};

export type ExportPreflight = {
  requested: number;
  found: number;
  missingIds: number;
  xmlAvailable: number;
  xmlMissing: number;
  byType: Record<string, number>;
  realPeriodMin?: string;
  realPeriodMax?: string;
  informedCompetence?: string;
  outsideCompetenceCount: number;
  parseErrorCount: number;
  duplicateCount: number;
  totalValue: string;
  privacy: ExportPrivacyPolicy;
  warnings: string[];
  estimatedBytes: Record<string, number>;
  requiresCompetenceAck: boolean;
};
