import type { DocumentSummary, DocumentType } from "@/types";

/**
 * Whether an authorization protocol (nProt) is expected for this document.
 * Incomplete origins (distribution summaries, municipal NFS-e, raw detNFe without proc) may be N/A.
 */
export function isProtocolRequired(document: Pick<DocumentSummary, "documentType" | "rawJson" | "schemaVersion">): {
  required: boolean;
  classification: "error" | "warning" | "info" | "not_applicable" | "incomplete_origin";
  reason: string;
} {
  const t = document.documentType;
  if (t === "NFSE" || t === "UNKNOWN" || t === "EVENT" || t === "CANCELATION" || t === "CORRECTION_LETTER") {
    return {
      required: false,
      classification: "not_applicable",
      reason: "Tipo de documento não exige protocolo de autorização NF-e/CT-e no envelope padrão.",
    };
  }
  if (t === "NFE" || t === "NFCE" || t === "CTE") {
    const flat = JSON.stringify(document.rawJson || {}).toLowerCase();
    // Heuristic: raw without any proc/prot markers may be incomplete export
    if (flat.length > 20 && !flat.includes("prot") && !flat.includes("nfeproc") && !flat.includes("cteproc")) {
      return {
        required: true,
        classification: "incomplete_origin",
        reason: "Documento elegível, mas o XML pode ser origem incompleta (sem envelope de protocolo).",
      };
    }
    return {
      required: true,
      classification: "warning",
      reason: "NF-e/NFC-e/CT-e autorizados normalmente incluem nProt no envelope de protocolo.",
    };
  }
  return {
    required: false,
    classification: "not_applicable",
    reason: "Tipo não classificado para protocolo.",
  };
}

export function protocolEligibleTypes(): DocumentType[] {
  return ["NFE", "NFCE", "CTE"];
}
