/**
 * PVA validation workflow — import official PVA report results.
 * Does not automate or redistribute the PVA.
 */

import type { EfdGenerationStatus } from "@/modules/obligations/efd-icms-ipi/status";

export type PvaResultStatus = "ok" | "errors" | "warnings" | "unknown";

export interface PvaValidationImport {
  generationId: string;
  contentHash?: string;
  pvaVersion: string;
  resultStatus: PvaResultStatus;
  validatedAt?: string;
  issues: Array<{
    code?: string;
    message: string;
    severity?: "error" | "warning" | "info";
    recordType?: string;
    /** EFD registry block (e.g. "0", "C", "E") when identifiable. */
    block?: string;
    /** Specific field number within the registry (e.g. "02"). */
    field?: string;
    /** Source line in the generated TXT, when the PVA reports it. */
    line?: string;
    /** Validation rule identifier (e.g. "E001") or human rule text. */
    rule?: string;
    /** Offending value reported by the PVA, when present. */
    value?: string;
    linkedGenerationIssueId?: string;
  }>;
  reportStoragePath?: string;
  notes?: string;
  recordedBy?: string;
}

export interface PvaValidationRecord extends PvaValidationImport {
  id: string;
  importedAt: string;
  disclaimer: string;
  validationLevel: 3;
}

const DISCLAIMER =
  "Resultado conforme relatório informado pelo usuário a partir do PVA oficial. O sistema não executa o PVA nem declara conformidade automática.";

export function mapPvaIssuesToInternal(input: PvaValidationImport): PvaValidationRecord {
  if (!input.contentHash?.trim()) {
    // Soft allow for legacy, but tag note — homologation matrix requires hash
    input = {
      ...input,
      notes: [input.notes, "AVISO: contentHash ausente — não conta para validated_scope"]
        .filter(Boolean)
        .join(" | "),
    };
  }
  return {
    id: `pva_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    importedAt: new Date().toISOString(),
    validationLevel: 3,
    disclaimer: DISCLAIMER,
    validatedAt: input.validatedAt || new Date().toISOString(),
    ...input,
  };
}

/** Homologation bar: contentHash + pvaVersion + non-unknown result. */
export function isHomologationGradePvaRun(run: Pick<PvaValidationImport, "contentHash" | "pvaVersion" | "resultStatus">): boolean {
  return Boolean(
    run.contentHash?.trim() &&
      run.pvaVersion?.trim() &&
      run.resultStatus &&
      run.resultStatus !== "unknown",
  );
}

/**
 * Parse a user-supplied PVA validation report into structured issues.
 *
 * Tolerant of the usual RFB PVA textual shapes, both block and inline:
 *   ERRO / Registro: 0000 / Campo: 02 / Linha: 1 / Regra: E001 / Valor: ... / Mensagem: ...
 *   Erro no Registro 0000, Campo 02, Linha 1: período incompatível
 *   E001 - Bloco 0 - Registro 0000: período incompatível
 *
 * Anything not matching a known shape is kept as a message-only issue so no
 * information is silently dropped. This is the bridge between the official PVA
 * and the in-app root-cause mapping (PR3) — it does NOT invent errors.
 */
export function parsePvaReportText(text: string): PvaValidationImport["issues"] {
  const raw = String(text ?? "");
  if (!raw.trim()) return [];

  // Split into blocks. A block is one PVA issue: it starts at a severity marker
  // or a "Bloco"-prefixed line, or at any line that is NOT a continuation
  // key-value (Registro:/Campo:/Linha:/Regra:/Valor:/Mensagem:/Bloco:).
  const CONT_KEYS = /^(Registro|Campo|Linha|Regra|Valor|Mensagem|Bloco)\s*[:\-–]/i;
  const blocks = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .reduce<Array<string[]>>((acc, line) => {
      const severityMarker = /^(ERRO|AVISO|INFO|ERROR|WARNING)\b/i.test(line);
      const blocoPattern = /^\w{3,5}\s*[-–]\s*Bloco/i.test(line);
      const isContinuation = CONT_KEYS.test(line);
      const startsBlock =
        severityMarker ||
        blocoPattern ||
        (!isContinuation && (acc.length === 0 || acc[acc.length - 1].length > 0));
      if (startsBlock || acc.length === 0) acc.push([line]);
      else acc[acc.length - 1].push(line);
      return acc;
    }, []);

  const issues: PvaValidationImport["issues"] = [];

  const severityOf = (s: string): "error" | "warning" | "info" => {
    const t = s.toUpperCase();
    if (t.startsWith("ERR") || t === "ERRO") return "error";
    if (t.startsWith("AV") || t.startsWith("WARN")) return "warning";
    return "info";
  };

  for (const block of blocks) {
    const joined = block.join(" ");
    const regMatch = joined.match(/Registro\s*[:\s-]+\s*([A-Z]?[0-9]{3,4})/i) ||
      joined.match(/\bRegistro\s+([A-Z]?[0-9]{3,4})\b/i);
    const fieldMatch = joined.match(/Campo\s*[:\s-]+\s*([0-9]{1,3})/i) ||
      joined.match(/ campo\s+([0-9]{1,3})/i);
    const lineMatch = joined.match(/Linha\s*[:\s-]+\s*([0-9]+)/i) ||
      joined.match(/\blinha\s+([0-9]+)/i);
    const ruleMatch = joined.match(/\b([A-Z][0-9]{2,4})\b/) ||
      joined.match(/Regra\s*[:\s-]+\s*(.+?)(?:\n|$)/i);
    const blockMatch = joined.match(/Bloco\s*[:\s-]+\s*([0-9A-Za-z])/i);
    const valueMatch = joined.match(/Valor\s*[:\s-]+\s*(.+?)(?=\s*Mensagem\s*:|$)/i);

    const sevMatch = joined.match(/\b(ERRO|AVISO|INFO|ERROR|WARNING)\b/i);
    let severity: "error" | "warning" | "info";
    if (sevMatch) severity = severityOf(sevMatch[1]);
    else if (ruleMatch && /^E\d/i.test(ruleMatch[1])) severity = "error";
    else if (ruleMatch && /^A\d/i.test(ruleMatch[1])) severity = "warning";
    else if (/erro/i.test(joined)) severity = "error";
    else if (/aviso|warning/i.test(joined)) severity = "warning";
    else severity = "info";

    // Message: prefer explicit "Mensagem:" text, else the free text after the
    // severity marker with structured tokens stripped.
    const msgMatch = joined.match(/Mensagem\s*[:\s-]+\s*(.+)/i);
    let message = msgMatch ? msgMatch[1].trim() : joined;
    if (!msgMatch) {
      message = message
        .replace(/^(ERRO|AVISO|INFO|ERROR|WARNING)\s*[:\s-]+/i, "")
        .replace(/Registro\s*[:\s-]+\s*[0-9]{3,4}/gi, "")
        .replace(/Campo\s*[:\s-]+\s*[0-9]{1,3}/gi, "")
        .replace(/Linha\s*[:\s-]+\s*[0-9]+/gi, "")
        .replace(/Regra\s*[:\s-]+\s*/gi, "")
        .replace(/Valor\s*[:\s-]+\s*/gi, "")
        .replace(/Bloco\s*[:\s-]+\s*[0-9A-Za-z]/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }

    const issue: PvaValidationImport["issues"][number] = { severity, message };
    if (regMatch) issue.recordType = regMatch[1];
    if (fieldMatch) issue.field = fieldMatch[1];
    if (lineMatch) issue.line = lineMatch[1];
    if (blockMatch) issue.block = blockMatch[1].toUpperCase();
    if (ruleMatch) issue.rule = ruleMatch[1].trim();
    if (valueMatch) issue.value = valueMatch[1].trim();
    if (sevMatch) issue.code = sevMatch[1].toUpperCase();
    issues.push(issue);
  }

  return issues;
}

export function inferPvaStatus(issues: PvaValidationImport["issues"]): PvaResultStatus {
  if (!issues.length) return "ok";
  if (issues.some((i) => i.severity === "error")) return "errors";
  if (issues.some((i) => i.severity === "warning")) return "warnings";
  return "unknown";
}

export function pvaResultToGenerationStatus(status: PvaResultStatus): EfdGenerationStatus {
  if (status === "ok") return "pva_validated";
  if (status === "errors") return "pva_rejected";
  if (status === "warnings") return "pva_validated";
  return "pva_validation_pending";
}

const LS_KEY = "xfi_pva_runs";

export function loadLocalPvaRuns(): PvaValidationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PvaValidationRecord[];
  } catch {
    return [];
  }
}

export function saveLocalPvaRun(record: PvaValidationRecord): void {
  const all = loadLocalPvaRuns();
  all.unshift(record);
  localStorage.setItem(LS_KEY, JSON.stringify(all.slice(0, 50)));
}

export type PvaCompareResult = {
  leftId: string;
  rightId: string;
  added: PvaValidationImport["issues"];
  removed: PvaValidationImport["issues"];
  unchangedCount: number;
};

function issueKey(issue: PvaValidationImport["issues"][number]): string {
  return `${issue.code || ""}|${issue.severity || ""}|${issue.message}`;
}

/** Diff two registered PVA runs by issue identity (code+severity+message). */
export function comparePvaRuns(
  left: PvaValidationRecord,
  right: PvaValidationRecord,
): PvaCompareResult {
  const leftKeys = new Set(left.issues.map(issueKey));
  const rightKeys = new Set(right.issues.map(issueKey));
  const added = right.issues.filter((i) => !leftKeys.has(issueKey(i)));
  const removed = left.issues.filter((i) => !rightKeys.has(issueKey(i)));
  const unchangedCount = left.issues.filter((i) => rightKeys.has(issueKey(i))).length;
  return {
    leftId: left.id,
    rightId: right.id,
    added,
    removed,
    unchangedCount,
  };
}
