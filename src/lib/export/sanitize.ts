/**
 * Neutralize CSV/Excel formula injection for untrusted cell values.
 * Prefixes leading = + - @ with a single quote when exporting as data.
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

export function sanitizeSpreadsheetRow(
  row: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else {
      out[k] = sanitizeSpreadsheetCell(v);
    }
  }
  return out;
}
