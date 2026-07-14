/**
 * ERP connector genérico CSV/JSON — mapeamento + preview + idempotência.
 * Sem TOTVS/SAP/Senior/Omie específicos.
 */

export type ErpFieldMap = {
  sourceColumn: string;
  targetField: string;
};

export type ErpImportPreviewRow = {
  rowIndex: number;
  values: Record<string, string>;
  errors: string[];
};

export type ErpImportPreview = {
  domain: "ledger_accounts" | "ledger_entries" | "contrib_entries" | "generic";
  mapped: ErpImportPreviewRow[];
  okCount: number;
  errorCount: number;
  idempotencyKeys: string[];
};

/** CSV simples → preview com mapa de colunas. */
export function previewCsvImport(
  csv: string,
  map: ErpFieldMap[],
  domain: ErpImportPreview["domain"],
): ErpImportPreview {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    return { domain, mapped: [], okCount: 0, errorCount: 0, idempotencyKeys: [] };
  }
  const headers = lines[0]!.split(/[;,\t]/).map((h) => h.trim());
  const mapped: ErpImportPreviewRow[] = [];
  const idempotencyKeys: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(/[;,\t]/);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = (cols[idx] || "").trim();
    });
    const values: Record<string, string> = {};
    const errors: string[] = [];
    for (const m of map) {
      const v = raw[m.sourceColumn];
      if (v == null || v === "") errors.push(`coluna ${m.sourceColumn} vazia`);
      else values[m.targetField] = v;
    }
    const idem =
      values.idempotencyKey ||
      values.id ||
      `row_${i}_${values.code || values.amount || i}`;
    if (idempotencyKeys.includes(idem)) errors.push(`idempotency duplicada: ${idem}`);
    else idempotencyKeys.push(idem);
    mapped.push({ rowIndex: i, values, errors });
  }
  return {
    domain,
    mapped,
    okCount: mapped.filter((r) => !r.errors.length).length,
    errorCount: mapped.filter((r) => r.errors.length).length,
    idempotencyKeys,
  };
}

export function previewJsonImport(
  json: unknown,
  domain: ErpImportPreview["domain"],
): ErpImportPreview {
  const rows = Array.isArray(json) ? json : Array.isArray((json as { rows?: unknown })?.rows)
    ? ((json as { rows: unknown[] }).rows)
    : [];
  const mapped: ErpImportPreviewRow[] = [];
  const idempotencyKeys: string[] = [];
  rows.forEach((row, i) => {
    const values =
      row && typeof row === "object" ? (row as Record<string, string>) : {};
    const errors: string[] = [];
    if (!Object.keys(values).length) errors.push("objeto vazio");
    const idem = String(values.idempotencyKey || values.id || `json_${i}`);
    if (idempotencyKeys.includes(idem)) errors.push(`idempotency duplicada: ${idem}`);
    else idempotencyKeys.push(idem);
    mapped.push({
      rowIndex: i,
      values: Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, String(v ?? "")]),
      ),
      errors,
    });
  });
  return {
    domain,
    mapped,
    okCount: mapped.filter((r) => !r.errors.length).length,
    errorCount: mapped.filter((r) => r.errors.length).length,
    idempotencyKeys,
  };
}
