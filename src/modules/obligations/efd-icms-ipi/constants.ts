export const EFD_ICMS_IPI_LAYOUT_2026 = "EFD_ICMS_IPI_2026_DRAFT";
export const EFD_SOURCE_ID = "official:sped:efd-icms-ipi:pending-registry";

/**
 * COD_VER conforme tabela do Ato COTEPE / NT (validado pelo PVA contra DT_FIN).
 * 018=2024 · 019=2025 · 020=2026 (NT 2025.001).
 */
export function efdIcmsIpiCodVer(periodEndIso?: string): string {
  const y = Number((periodEndIso || "").slice(0, 4));
  if (!Number.isFinite(y) || y <= 0) return "020";
  if (y >= 2026) return "020";
  if (y >= 2025) return "019";
  if (y >= 2024) return "018";
  return "017";
}
