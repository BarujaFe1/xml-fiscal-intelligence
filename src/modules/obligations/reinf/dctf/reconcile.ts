/**
 * DCTFWeb reconciliation via imported official report lines (CSV-like).
 * Does NOT access DCTFWeb portal.
 */

export type DctfWebDebitLine = {
  periodKey: string;
  revenueCode: string;
  amount: string;
  sourceLine: string;
};

export type ReinfDebitExpectation = {
  periodKey: string;
  eventCode: string;
  eventId: string;
  amount: string;
};

export type DctfReconFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  periodKey?: string;
  revenueCode?: string;
  eventId?: string;
};

export type DctfReconResult = {
  ok: boolean;
  findings: DctfReconFinding[];
  matched: number;
  unmatchedDctf: number;
  unmatchedReinf: number;
};

/** Parse semicolon/comma CSV: period;cod_receita;valor */
export function parseDctfWebImportCsv(text: string): DctfWebDebitLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: DctfWebDebitLine[] = [];
  for (const line of lines) {
    if (/^periodo|^period|competencia/i.test(line)) continue;
    const parts = line.split(/[;,]/).map((p) => p.trim());
    if (parts.length < 3) continue;
    const [periodKey, revenueCode, amount] = parts;
    if (!periodKey || !revenueCode) continue;
    out.push({
      periodKey: periodKey.slice(0, 7),
      revenueCode,
      amount: amount || "0",
      sourceLine: line,
    });
  }
  return out;
}

function normMoney(v: string): string {
  const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

/**
 * Match by period + amount (tolerance 0). revenueCode mapping deferred to catalog.
 */
export function reconcileDctfVsReinf(
  dctf: DctfWebDebitLine[],
  reinf: ReinfDebitExpectation[],
): DctfReconResult {
  const findings: DctfReconFinding[] = [];
  const usedReinf = new Set<string>();
  let matched = 0;

  for (const d of dctf) {
    const amt = normMoney(d.amount);
    const hit = reinf.find(
      (r) =>
        !usedReinf.has(r.eventId) &&
        r.periodKey === d.periodKey &&
        normMoney(r.amount) === amt &&
        amt !== "",
    );
    if (hit) {
      usedReinf.add(hit.eventId);
      matched += 1;
    } else {
      findings.push({
        code: "DCTF_UNMATCHED",
        severity: "warning",
        message: `Débito DCTF sem par Reinf: ${d.periodKey} ${d.revenueCode} ${d.amount}`,
        periodKey: d.periodKey,
        revenueCode: d.revenueCode,
      });
    }
  }

  for (const r of reinf) {
    if (usedReinf.has(r.eventId)) continue;
    findings.push({
      code: "REINF_UNMATCHED",
      severity: "warning",
      message: `Evento Reinf sem par DCTF: ${r.eventCode} ${r.periodKey} ${r.amount}`,
      periodKey: r.periodKey,
      eventId: r.eventId,
    });
  }

  if (!dctf.length) {
    findings.push({
      code: "DCTF_EMPTY",
      severity: "info",
      message: "Import DCTFWeb vazio — cole o relatório oficial exportado",
    });
  }

  return {
    ok: !findings.some((f) => f.severity === "error"),
    findings,
    matched,
    unmatchedDctf: findings.filter((f) => f.code === "DCTF_UNMATCHED").length,
    unmatchedReinf: findings.filter((f) => f.code === "REINF_UNMATCHED").length,
  };
}
