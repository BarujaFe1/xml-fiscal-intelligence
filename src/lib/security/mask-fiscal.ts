/**
 * Mask fiscal identifiers for UI/logs. Shared privacy helper (not AI).
 */
export function maskFiscalText(input: string): string {
  return input
    .replace(/\b\d{44}\b/g, "[CHAVE]")
    .replace(/\b\d{14}\b/g, "[CNPJ]")
    .replace(/\b\d{11}\b/g, "[CPF]");
}
