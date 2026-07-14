import type { ClosingCellStatus } from "@/modules/obligations/core/maturity";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

export type ClosingCell = {
  obligationId: ObligationId;
  status: ClosingCellStatus;
  readinessPercent: number;
  assignee?: string;
  reviewer?: string;
  dueDate?: string;
  blockedReason?: string;
  comments: Array<{ at: string; author?: string; text: string }>;
  checklist: Array<{ id: string; label: string; done: boolean }>;
  updatedAt: string;
};

export type ClosingPeriodCard = {
  id: string;
  workspaceId: string;
  companyId: string;
  companyLabel: string;
  establishmentId: string;
  establishmentLabel: string;
  /** YYYY-MM for monthly; YYYY for annual */
  periodKey: string;
  periodKind: "monthly" | "annual";
  cells: Partial<Record<ObligationId, ClosingCell>>;
  createdAt: string;
  updatedAt: string;
};

export function emptyCell(obligationId: ObligationId): ClosingCell {
  return {
    obligationId,
    status: "not_started",
    readinessPercent: 0,
    comments: [],
    checklist: [
      { id: "data", label: "Dados importados/conferidos", done: false },
      { id: "generate", label: "Geração assistida", done: false },
      { id: "internal", label: "Validação interna", done: false },
      { id: "official", label: "Resultado no programa oficial registrado", done: false },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function cardReadiness(card: ClosingPeriodCard): number {
  const cells = Object.values(card.cells).filter(Boolean) as ClosingCell[];
  if (!cells.length) return 0;
  return Math.round(cells.reduce((a, c) => a + c.readinessPercent, 0) / cells.length);
}
