export type ExportAggregation =
  | "first"
  | "last"
  | "first_non_empty"
  | "first_exact_path"
  | "distinct_list"
  | "ordered_list"
  | "decimal_sum"
  | "decimal_min"
  | "decimal_max"
  | "count"
  | "explode_rows";

export type ExportFieldScope =
  | "document"
  | "documento"
  | "emitter"
  | "emitente"
  | "receiver"
  | "destinatario"
  | "item"
  | "totals"
  | "totais"
  | "billing"
  | "cobranca"
  | "payment"
  | "transport"
  | "protocol"
  | "signature"
  | "identificacao"
  | "impostos"
  | "other"
  | string;

export type ExportFieldDataType =
  | "text"
  | "identifier"
  | "date"
  | "datetime"
  | "decimal"
  | "integer"
  | "boolean"
  | "base64"
  | string;

export type TranslationStatus =
  | "official"
  | "curated"
  | "generated"
  | "review_needed"
  | string;

export type ExportFieldDefinition = {
  fieldId: string;
  technicalLabel: string;
  humanLabelPtBr: string;
  /** Requested Excel header when curated (e.g. CCASSTRIB) */
  requestedHeader?: string;
  xmlPaths: string[];
  indexedExample?: string;
  scope: ExportFieldScope;
  dataType: ExportFieldDataType;
  cardinality: "one" | "optional" | "many";
  defaultAggregation?: ExportAggregation;
  defaultSelected: boolean;
  defaultOrder?: number;
  officialSource?: string;
  catalogVersion: string;
  translationStatus: TranslationStatus;
  coverageHint?: { docs?: number; pct?: string; maxOcc?: number };
};

export type ExportFieldPresetColumn = {
  fieldId: string;
  order: number;
  headerMode: "human" | "technical" | "both";
  headerOverride?: string;
  aggregation?: ExportAggregation;
};

export type ExportFieldPreset = {
  schemaVersion: "1.0.0";
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  columns: ExportFieldPresetColumn[];
};

export type ExportFieldOccurrence = {
  batchId: string;
  batchName?: string;
  documentId: string;
  accessKey?: string;
  number?: string;
  scope: string;
  occurrenceIndex?: number;
  xmlPath: string;
  tag: string;
  humanLabel: string;
  dataType: string;
  value: string;
};
