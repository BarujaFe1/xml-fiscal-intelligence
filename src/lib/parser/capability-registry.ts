import type { DocumentType } from "@/types";

export type ParserSupportStatus = "supported" | "partial" | "best_effort" | "unknown";

export interface ParserCapability {
  family: string;
  standard: string;
  version: string;
  namespacePatterns: string[];
  status: ParserSupportStatus;
  fixtures: string[];
  testedEvents: string[];
  knownLimitations: string[];
  documentTypes: DocumentType[];
}

/**
 * Declared capability matrix — must match what the landing and UI claim.
 * Update when fixtures/tests expand coverage.
 */
export const PARSER_CAPABILITIES: ParserCapability[] = [
  {
    family: "NF-e",
    standard: "PL_009 / portal NF-e",
    version: "best_effort",
    namespacePatterns: ["http://www.portalfiscal.inf.br/nfe"],
    status: "supported",
    fixtures: ["tests/fixtures implied via unit parser tests"],
    testedEvents: ["autorizacao", "cancelamento", "cce"],
    knownLimitations: ["XSD oficial não embutido por padrão", "RTC tags apenas observação"],
    documentTypes: ["NFE", "NFCE", "EVENT", "CANCELATION", "CORRECTION_LETTER"],
  },
  {
    family: "CT-e",
    standard: "portal CT-e",
    version: "best_effort",
    namespacePatterns: ["http://www.portalfiscal.inf.br/cte"],
    status: "supported",
    fixtures: [],
    testedEvents: ["autorizacao"],
    knownLimitations: ["CT-e OS parcial", "eventos avançados best-effort"],
    documentTypes: ["CTE"],
  },
  {
    family: "NFS-e",
    standard: "municipal / ABRASF / padrão nacional (variável)",
    version: "unknown",
    namespacePatterns: [],
    status: "best_effort",
    fixtures: [],
    testedEvents: [],
    knownLimitations: [
      "Sem matriz municipal completa",
      "Padrão desconhecido: preservar arquivo e marcar UNKNOWN/NFSE parcial",
      "Nunca descartar XML",
    ],
    documentTypes: ["NFSE"],
  },
];

export function getParserCapabilityForType(type: DocumentType): ParserCapability | undefined {
  return PARSER_CAPABILITIES.find((c) => c.documentTypes.includes(type));
}

export function parserSupportSummary(): Array<{
  family: string;
  status: ParserSupportStatus;
  limitations: string;
}> {
  return PARSER_CAPABILITIES.map((c) => ({
    family: c.family,
    status: c.status,
    limitations: c.knownLimitations[0] || "",
  }));
}
