/**
 * Deterministic XML × EFD reconciliation for common NF-e scenarios.
 * Does not invent missing documents — only compares what is present.
 */

import type { ObligationContext } from "@/modules/obligations/core/types";

export type XmlEfdAuditFinding = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  documentId?: string;
  accessKey?: string;
};

export type XmlEfdAuditResult = {
  ok: boolean;
  findings: XmlEfdAuditFinding[];
  xmlNfeCount: number;
  efdC100Keys: string[];
  missingInEfd: string[];
  extraInEfd: string[];
};

/** Extract access keys that would feed C100 (NFE / model 55). */
export function expectedC100KeysFromContext(ctx: ObligationContext): Array<{
  id: string;
  accessKey: string;
  totalValue?: string;
}> {
  const out: Array<{ id: string; accessKey: string; totalValue?: string }> = [];
  for (const d of ctx.documents) {
    if (!(d.documentType === "NFE" || d.model === "55")) continue;
    const key = (d.accessKey || "").replace(/\D/g, "");
    if (key.length >= 44) {
      out.push({ id: d.id, accessKey: key.slice(0, 44), totalValue: d.totalValue });
    }
  }
  return out;
}

/** Parse CHV_NFE field from serialized TXT lines `|C100|...|`. */
export function extractC100KeysFromTxt(content: string): Map<string, string> {
  /** key → VL_DOC (field index 11 in C100 after REG — index 12 if counting empty splits carefully) */
  const map = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    if (!line.includes("|C100|")) continue;
  const fields = line.split("|").filter((x, idx, a) => idx > 0 && idx < a.length - 1);
    if (fields[0] !== "C100") continue;
    const chv = (fields[8] || "").replace(/\D/g, "").slice(0, 44);
    const vlDoc = fields[11] || "";
    if (chv.length === 44) map.set(chv, vlDoc);
  }
  return map;
}

export function auditXmlVsEfdTxt(
  ctx: ObligationContext,
  efdTxt: string,
): XmlEfdAuditResult {
  const findings: XmlEfdAuditFinding[] = [];
  const expected = expectedC100KeysFromContext(ctx);
  const efdMap = extractC100KeysFromTxt(efdTxt);
  const efdKeys = [...efdMap.keys()];
  const expSet = new Set(expected.map((e) => e.accessKey));
  const efdSet = new Set(efdKeys);

  const missingInEfd = [...expSet].filter((k) => !efdSet.has(k));
  const extraInEfd = [...efdSet].filter((k) => !expSet.has(k));

  for (const miss of missingInEfd) {
    const doc = expected.find((e) => e.accessKey === miss);
    findings.push({
      code: "XML_KEY_MISSING_IN_EFD",
      severity: "error",
      message: `Chave presente no lote XML não gerou C100: ${miss}`,
      documentId: doc?.id,
      accessKey: miss,
    });
  }
  for (const extra of extraInEfd) {
    findings.push({
      code: "EFD_KEY_NOT_IN_XML",
      severity: "warning",
      message: `C100 com chave ausente do contexto XML atual: ${extra}`,
      accessKey: extra,
    });
  }

  for (const e of expected) {
    const vlEfd = efdMap.get(e.accessKey);
    if (vlEfd == null || e.totalValue == null) continue;
    const normXml = normalizeMoney(e.totalValue);
    const normEfd = normalizeMoney(vlEfd);
    if (normXml && normEfd && normXml !== normEfd) {
      findings.push({
        code: "XML_EFD_TOTAL_MISMATCH",
        severity: "warning",
        message: `VL_DOC EFD (${vlEfd}) ≠ total XML (${e.totalValue}) chave ${e.accessKey}`,
        documentId: e.id,
        accessKey: e.accessKey,
      });
    }
  }

  if (!expected.length) {
    findings.push({
      code: "XML_NO_NFE",
      severity: "info",
      message: "Nenhuma NF-e/modelo 55 no contexto para conciliar",
    });
  }

  return {
    ok: !findings.some((f) => f.severity === "error"),
    findings,
    xmlNfeCount: expected.length,
    efdC100Keys: efdKeys,
    missingInEfd,
    extraInEfd,
  };
}

function normalizeMoney(v: string): string {
  const s = v.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}
