/**
 * PVA validation workflow — import official PVA report results.
 * Does not automate or redistribute the PVA.
 */

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
  return {
    id: `pva_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    importedAt: new Date().toISOString(),
    validationLevel: 3,
    disclaimer: DISCLAIMER,
    validatedAt: input.validatedAt || new Date().toISOString(),
    ...input,
  };
}

/** Parse a simple line-oriented PVA-like report (best-effort, user-supplied). */
export function parsePvaReportText(text: string): PvaValidationImport["issues"] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const issues: PvaValidationImport["issues"] = [];
  for (const line of lines) {
    const m = line.match(/^(ERRO|AVISO|INFO|ERROR|WARNING)[:\s-]+(.+)$/i);
    if (m) {
      const sev = m[1]!.toUpperCase();
      issues.push({
        severity:
          sev.startsWith("ERR") || sev === "ERRO"
            ? "error"
            : sev.startsWith("AV") || sev.startsWith("WARN")
              ? "warning"
              : "info",
        message: m[2]!.trim(),
      });
      continue;
    }
    if (/erro/i.test(line)) issues.push({ severity: "error", message: line });
    else if (/aviso|warning/i.test(line)) issues.push({ severity: "warning", message: line });
  }
  return issues;
}

export function inferPvaStatus(issues: PvaValidationImport["issues"]): PvaResultStatus {
  if (!issues.length) return "ok";
  if (issues.some((i) => i.severity === "error")) return "errors";
  if (issues.some((i) => i.severity === "warning")) return "warnings";
  return "unknown";
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
