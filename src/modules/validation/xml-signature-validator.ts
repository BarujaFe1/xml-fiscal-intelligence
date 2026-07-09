export type SignatureValidationStatus =
  | "valid"
  | "invalid"
  | "missing"
  | "unsupported"
  | "not_configured";

export interface SignatureValidationResult {
  status: SignatureValidationStatus;
  hasSignatureNode: boolean;
  message: string;
  technicalNotes: string[];
}

/**
 * Validação técnica de assinatura XML (não é parecer jurídico).
 * MVP: detecta presença de Signature e retorna not_configured para verificação criptográfica.
 */
export function validateXmlSignature(xml: string): SignatureValidationResult {
  const hasSignatureNode =
    /<([a-zA-Z0-9_]+:)?Signature[\s>]/i.test(xml) || xml.includes("http://www.w3.org/2000/09/xmldsig#");

  if (!hasSignatureNode) {
    return {
      status: "missing",
      hasSignatureNode: false,
      message: "Nó de assinatura XMLDSig não encontrado.",
      technicalNotes: ["Sem elemento Signature — comum em XMLs sem protocolo completo."],
    };
  }

  return {
    status: "not_configured",
    hasSignatureNode: true,
    message:
      "Assinatura detectada, mas verificação criptográfica (digest/certificado) ainda não está habilitada neste ambiente.",
    technicalNotes: [
      "Validação jurídica plena exige cadeia de certificados e política ICP-Brasil.",
      "Este resultado é apenas técnico/diagnóstico.",
    ],
  };
}
