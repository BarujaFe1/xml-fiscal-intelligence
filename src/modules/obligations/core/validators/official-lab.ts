import type { OfficialProgramId } from "@/modules/obligations/core/maturity";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export type OfficialValidatorResultStatus = "ok" | "errors" | "warnings" | "unknown";

export type OfficialValidatorRun = {
  id: string;
  workspaceId?: string;
  obligationId: ObligationId;
  program: OfficialProgramId;
  programVersion: string;
  osLabel?: string;
  generationId?: string;
  contentHash?: string;
  resultStatus: OfficialValidatorResultStatus;
  reportText?: string;
  evidencePath?: string;
  importedAt: string;
  responsible?: string;
  notes?: string;
  mappedIssues?: Array<{
    code?: string;
    message: string;
    record?: string;
    field?: string;
    event?: string;
  }>;
};

export const PROGRAM_LABELS: Record<OfficialProgramId, string> = {
  pva_efd_icms_ipi: "PVA EFD ICMS/IPI",
  pge_efd_contribuicoes: "PGE EFD-Contribuições",
  programa_ecd: "Programa ECD",
  programa_ecf: "Programa ECF",
  efd_reinf_ambiente: "Ambiente EFD-Reinf",
  dctfweb: "DCTFWeb",
  other: "Outro (metadados)",
};

const LS_KEY = "xfi_official_validator_runs";

export function loadLocalValidatorRuns(): OfficialValidatorRun[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfficialValidatorRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalValidatorRun(run: OfficialValidatorRun): void {
  const prev = loadLocalValidatorRuns();
  const next = [run, ...prev.filter((r) => r.id !== run.id)].slice(0, 200);
  localStorage.setItem(LS_KEY, JSON.stringify(next));
}

export function createValidatorRunId(): string {
  return `ovr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
