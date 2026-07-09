export type XsdValidationStatus =
  | "valid"
  | "invalid"
  | "not_configured"
  | "unsupported";

export interface XsdValidationResult {
  status: XsdValidationStatus;
  documentType: string;
  schemaVersion?: string;
  errors: string[];
  message: string;
}

/**
 * XSD validator stub — schemas versionados ainda não embutidos no MVP.
 * Retorna `not_configured` até `schemas/` ser provisionado.
 */
export function validateAgainstXsd(input: {
  xml: string;
  documentType: string;
}): XsdValidationResult {
  void input.xml;
  return {
    status: "not_configured",
    documentType: input.documentType,
    errors: [],
    message:
      "Validação XSD não configurada. Adicione schemas oficiais versionados em /schemas e habilite ENABLE_XSD_VALIDATION.",
  };
}
