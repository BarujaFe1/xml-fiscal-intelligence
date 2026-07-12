import { XMLParser, XMLValidator } from "fast-xml-parser";
import { v4 as uuidv4 } from "uuid";
import { detectDocumentType } from "@/lib/parser/detect";
import {
  extractCTeLinkedDocs,
  extractCTeSummary,
  extractNFSeServiceDetails,
  extractNFSeSummary,
  extractNFeItems,
  extractNFeSummary,
} from "@/lib/parser/extract";
import { flatFieldsToRecord, flattenXmlObject } from "@/lib/parser/flatten";
import { observeRtcTags } from "@/lib/parser/rtc-observe";
import { classifyOperation } from "@/lib/fiscal/cfop";
import type {
  DocumentField,
  DocumentItem,
  DocumentSummary,
  DocumentType,
  ParseError,
  ParseStatus,
} from "@/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  ignoreDeclaration: false,
  // Security: do not resolve external entities (XXE mitigation via fast-xml-parser defaults + processEntities:false)
});

export interface ParsedDocumentResult {
  document: DocumentSummary;
  items: DocumentItem[];
  fields: DocumentField[];
  error?: ParseError;
}

function buildSummary(
  documentType: DocumentType,
  parsed: unknown,
): ReturnType<typeof extractNFeSummary> {
  switch (documentType) {
    case "NFE":
      return extractNFeSummary(parsed);
    case "CTE":
      return extractCTeSummary(parsed);
    case "NFSE":
      return extractNFSeSummary(parsed);
    default:
      return {};
  }
}

function buildItems(documentType: DocumentType, parsed: unknown) {
  switch (documentType) {
    case "NFE":
      return extractNFeItems(parsed);
    case "CTE":
      return extractCTeLinkedDocs(parsed);
    case "NFSE":
      return extractNFSeServiceDetails(parsed);
    default:
      return [];
  }
}

export function parseXmlDocument(params: {
  xml: string;
  fileName: string;
  batchId: string;
  workspaceId: string;
}): ParsedDocumentResult {
  const { xml, fileName, batchId, workspaceId } = params;
  const documentId = uuidv4();
  const createdAt = new Date().toISOString();

  let parsed: unknown;
  try {
    const validation = XMLValidator.validate(xml, {
      allowBooleanAttributes: true,
    });
    if (validation !== true) {
      const message =
        typeof validation === "object" && validation && "err" in validation
          ? String((validation as { err: { msg?: string } }).err?.msg || "XML inválido")
          : "XML inválido";
      throw new Error(message);
    }
    parsed = parser.parse(xml);
    if (!parsed || (typeof parsed === "object" && Object.keys(parsed as object).length === 0)) {
      throw new Error("XML vazio ou sem estrutura reconhecível");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "XML malformado";
    const document: DocumentSummary = {
      id: documentId,
      workspaceId,
      batchId,
      documentType: "UNKNOWN",
      fileName,
      rawJson: {},
      flattenedJson: {},
      parseStatus: "error",
      parseErrors: [message],
      createdAt,
    };
    return {
      document,
      items: [],
      fields: [],
      error: {
        id: uuidv4(),
        workspaceId,
        batchId,
        fileName,
        errorType: "malformed_xml",
        errorMessage: message,
        rawSnippet: xml.slice(0, 400),
        createdAt,
      },
    };
  }

  const documentType = detectDocumentType(parsed, xml);
  const flat = flattenXmlObject(parsed);
  const flattenedJson = flatFieldsToRecord(flat);
  const rtcObservation = observeRtcTags({
    flattenedKeys: Object.keys(flattenedJson),
    rawXml: xml,
  });
  const summary = buildSummary(documentType, parsed);
  const extractedItems = buildItems(documentType, parsed);

  const parseErrors: string[] = [];
  if (documentType === "UNKNOWN") parseErrors.push("Estrutura documental desconhecida");
  if (
    documentType !== "NFSE" &&
    documentType !== "EVENT" &&
    documentType !== "CANCELATION" &&
    documentType !== "CORRECTION_LETTER" &&
    !summary.accessKey
  ) {
    parseErrors.push("Documento sem chave de acesso");
  }
  if (!summary.number && documentType !== "UNKNOWN" && documentType !== "EVENT") {
    parseErrors.push("Número não identificado");
  }

  let parseStatus: ParseStatus = "ok";
  if (documentType === "UNKNOWN") parseStatus = "error";
  else if (parseErrors.length) parseStatus = "partial";

  const cfopMain =
    summary.cfop || extractedItems.find((i) => i.cfop)?.cfop || undefined;
  const classification = classifyOperation({
    documentType,
    cfopMain,
    natureOperation: summary.nature,
  });

  const document: DocumentSummary = {
    id: documentId,
    workspaceId,
    batchId,
    documentType,
    fileName,
    accessKey: summary.accessKey,
    number: summary.number,
    series: summary.series,
    model: summary.model,
    issueDate: summary.issueDate,
    authorizationDate: summary.authorizationDate,
    emitterDoc: summary.emitterDoc,
    emitterName: summary.emitterName,
    emitterIe: summary.emitterIe,
    emitterCity: summary.emitterCity,
    emitterCityCode: summary.emitterCityCode,
    emitterUf: summary.emitterUf,
    emitterAddress: summary.emitterAddress,
    emitterAddressNumber: summary.emitterAddressNumber,
    emitterAddressCompl: summary.emitterAddressCompl,
    emitterNeighborhood: summary.emitterNeighborhood,
    emitterCep: summary.emitterCep,
    receiverDoc: summary.receiverDoc,
    receiverName: summary.receiverName,
    receiverIe: summary.receiverIe,
    receiverCity: summary.receiverCity,
    receiverCityCode: summary.receiverCityCode,
    receiverUf: summary.receiverUf,
    receiverAddress: summary.receiverAddress,
    receiverAddressNumber: summary.receiverAddressNumber,
    receiverAddressCompl: summary.receiverAddressCompl,
    receiverNeighborhood: summary.receiverNeighborhood,
    receiverCep: summary.receiverCep,
    serviceCity: summary.serviceCity,
    totalValue: summary.totalValue,
    productsValue: summary.productsValue,
    servicesValue: summary.servicesValue,
    freightValue: summary.freightValue,
    discountValue: summary.discountValue,
    taxValue: summary.taxValue,
    status: summary.status,
    protocol: summary.protocol,
    natureOperation: summary.nature,
    cfopMain,
    operationClassification: classification.classification,
    operationConfidence: classification.confidence,
    rawJson: parsed as Record<string, unknown>,
    flattenedJson,
    parseStatus,
    parseErrors,
    rtcObservation: rtcObservation.hasRtcHints ? rtcObservation : undefined,
    createdAt,
  };

  const items: DocumentItem[] = extractedItems.map((item) => {
    const itemFlat = flattenXmlObject(item.rawJson, "item");
    return {
      id: uuidv4(),
      workspaceId,
      batchId,
      documentId,
      documentType,
      itemNumber: item.itemNumber,
      code: item.code,
      description: item.description,
      ncm: item.ncm,
      cfop: item.cfop,
      unit: item.unit,
      quantity: item.quantity,
      unitValue: item.unitValue,
      totalValue: item.totalValue,
      discountValue: item.discountValue,
      taxJson: item.taxJson,
      rawJson: item.rawJson,
      flattenedJson: flatFieldsToRecord(itemFlat),
    };
  });

  const fields: DocumentField[] = flat.map((f) => ({
    id: uuidv4(),
    workspaceId,
    batchId,
    documentId,
    documentType,
    pathOriginal: f.pathOriginal,
    pathNormalized: f.pathNormalized,
    fieldName: f.fieldName,
    valueText: f.value === null || f.value === undefined ? undefined : String(f.value),
    valueNumber: typeof f.value === "number" ? f.value : undefined,
    valueDate: f.inferredType === "date" ? String(f.value) : undefined,
    inferredType: f.inferredType,
    isEmpty: f.isEmpty,
  }));

  return {
    document,
    items,
    fields,
    error:
      parseStatus === "error"
        ? {
            id: uuidv4(),
            workspaceId,
            batchId,
            fileName,
            errorType: documentType === "UNKNOWN" ? "unknown_structure" : "parse_error",
            errorMessage: parseErrors.join("; ") || "Falha no parse",
            rawSnippet: xml.slice(0, 400),
            createdAt,
          }
        : undefined,
  };
}
