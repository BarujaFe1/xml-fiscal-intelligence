/**
 * Conciliação DCTFWeb / MIT × apuração Contribuições (import CSV).
 * Não acessa portais RFB.
 */

export type MitDebitLine = {
  periodKey: string;
  revenueCode: string;
  amount: string;
  sourceLine: string;
  system: "dctfweb" | "mit";
};

export type ContribDebitExpectation = {
  periodKey: string;
  kind: string;
  entryId: string;
  amount: string;
};

export type ContribReconFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  periodKey?: string;
  revenueCode?: string;
  entryId?: string;
};

export type ContribReconResult = {
  ok: boolean;
  findings: ContribReconFinding[];
  matched: number;
  unmatchedImport: number;
  unmatchedContrib: number;
};

/** CSV: period;cod_receita;valor[;sistema] */
export function parseDctfMitImportCsv(text: string, defaultSystem: "dctfweb" | "mit" = "dctfweb"): MitDebitLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: MitDebitLine[] = [];
  for (const line of lines) {
    if (/^periodo|^period|competencia/i.test(line)) continue;
    const parts = line.split(/[;,]/).map((p) => p.trim());
    if (parts.length < 3) continue;
    const [periodKey, revenueCode, amount, sys] = parts;
    if (!periodKey || !revenueCode) continue;
    const system =
      sys?.toLowerCase() === "mit" ? "mit" : sys?.toLowerCase() === "dctfweb" ? "dctfweb" : defaultSystem;
    out.push({
      periodKey: periodKey.slice(0, 7),
      revenueCode,
      amount: amount || "0",
      sourceLine: line,
      system,
    });
  }
  return out;
}

function normMoney(v: string): string {
  const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

export function reconcileDctfMitVsContrib(
  imported: MitDebitLine[],
  contrib: ContribDebitExpectation[],
): ContribReconResult {
  const findings: ContribReconFinding[] = [];
  const used = new Set<string>();
  let matched = 0;

  for (const d of imported) {
    const amt = normMoney(d.amount);
    const hit = contrib.find(
      (c) =>
        !used.has(c.entryId) &&
        c.periodKey === d.periodKey &&
        normMoney(c.amount) === amt,
    );
    if (hit) {
      used.add(hit.entryId);
      matched += 1;
      findings.push({
        code: "MATCH",
        severity: "info",
        message: `${d.system} ${d.revenueCode} ↔ ${hit.kind} ${hit.entryId}`,
        periodKey: d.periodKey,
        revenueCode: d.revenueCode,
        entryId: hit.entryId,
      });
    } else {
      findings.push({
        code: "UNMATCHED_IMPORT",
        severity: "warning",
        message: `${d.system} sem contraparte: ${d.revenueCode} ${d.amount}`,
        periodKey: d.periodKey,
        revenueCode: d.revenueCode,
      });
    }
  }

  let unmatchedContrib = 0;
  for (const c of contrib) {
    if (used.has(c.entryId)) continue;
    unmatchedContrib += 1;
    findings.push({
      code: "UNMATCHED_CONTRIB",
      severity: "warning",
      message: `Apuração sem contraparte import: ${c.kind} ${c.amount}`,
      periodKey: c.periodKey,
      entryId: c.entryId,
    });
  }

  const unmatchedImport = findings.filter((f) => f.code === "UNMATCHED_IMPORT").length;
  return {
    ok: unmatchedImport === 0 && unmatchedContrib === 0,
    findings,
    matched,
    unmatchedImport,
    unmatchedContrib,
  };
}
