/**
 * Fiscal calendar — versioned rules only; never invent due dates.
 * Seed only after official source + lastVerifiedAt.
 */

import {
  listCalendarCatalog,
  type FiscalCalendarRule,
} from "@/modules/ops/calendar";

export type { FiscalCalendarRule };

/**
 * @deprecated Prefer listCalendarCatalog — mantido para compat.
 * Catálogo descritivo Fase 7 (sem datas inventadas).
 */
export const FISCAL_CALENDAR_RULES: FiscalCalendarRule[] = [];

export function listCalendarRules(filter?: {
  obligationId?: string;
  uf?: string;
}): FiscalCalendarRule[] {
  return listCalendarCatalog(filter);
}
