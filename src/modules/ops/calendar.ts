/**
 * Fiscal calendar catalog — versioned rules only; never invent numeric due dates.
 */

export type FiscalCalendarRule = {
  id: string;
  obligationId: string;
  /** Human description from official source — not an invented date. */
  description: string;
  sourceId: string;
  /** Optional structured due rule when taken from official text (may be empty). */
  dueRule?: string;
  uf?: string;
  regime?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  overrideReason?: string;
  createdAt: string;
};

const NOW = "2026-07-14T00:00:00.000Z";

/**
 * Regras descritivas com sourceId — dueRule é texto da obrigação legal,
 * NÃO uma data inventada (ex.: "dia 15").
 */
export const FISCAL_CALENDAR_CATALOG: FiscalCalendarRule[] = [
  {
    id: "cal_efd_icms_ipi_monthly",
    obligationId: "efd-icms-ipi",
    description:
      "EFD ICMS/IPI — prazo de entrega mensal conforme legislação/PVA vigentes (consultar fonte; sem dia fixo no produto).",
    sourceId: "official:sped:efd-icms-ipi:hub",
    dueRule: "conforme legislação estadual/federal aplicável — não codificado aqui",
    createdAt: NOW,
  },
  {
    id: "cal_efd_contrib_monthly",
    obligationId: "efd-contribuicoes",
    description:
      "EFD-Contribuições — prazo mensal conforme RFB/PGE; NT 11/2026 catalogada (orientação de descontinuidade, sem data inventada).",
    sourceId: "official:sped:efd-contribuicoes:hub",
    dueRule: "conforme ato normativo vigente no PGE",
    createdAt: NOW,
  },
  {
    id: "cal_ecd_annual",
    obligationId: "ecd",
    description: "ECD — entrega anual conforme Programa ECD / IN aplicável.",
    sourceId: "official:sped:ecd:hub",
    dueRule: "conforme calendário oficial do Programa ECD",
    createdAt: NOW,
  },
  {
    id: "cal_ecf_annual",
    obligationId: "ecf",
    description: "ECF — entrega anual conforme Programa ECF.",
    sourceId: "official:sped:ecf:hub",
    dueRule: "conforme calendário oficial do Programa ECF",
    createdAt: NOW,
  },
  {
    id: "cal_reinf_monthly",
    obligationId: "reinf",
    description: "EFD-Reinf — eventos periódicos conforme manual/ambiente RFB.",
    sourceId: "official:sped:efd-reinf:hub",
    dueRule: "conforme Manual de Orientação EFD-Reinf",
    createdAt: NOW,
  },
];

export function listCalendarCatalog(filter?: {
  obligationId?: string;
  uf?: string;
}): FiscalCalendarRule[] {
  return FISCAL_CALENDAR_CATALOG.filter((r) => {
    if (filter?.obligationId && r.obligationId !== filter.obligationId) return false;
    if (filter?.uf && r.uf && r.uf !== filter.uf) return false;
    return true;
  });
}

/** Override só com razão + sourceId — ainda sem inventar data numérica. */
export function assertCalendarOverride(rule: Partial<FiscalCalendarRule>): string | null {
  if (!rule.sourceId) return "override exige sourceId";
  if (!rule.overrideReason?.trim()) return "override exige overrideReason";
  if (!rule.description?.trim()) return "override exige description";
  return null;
}

/**
 * iCal mínimo: âncora na competência (periodKey-01) como lembrete,
 * NÃO como vencimento legal.
 */
export function buildIcalReminder(opts: {
  obligationId: string;
  periodKey: string;
  summary: string;
  sourceId: string;
}): string {
  const day = `${opts.periodKey.replace(/-/g, "")}01`;
  const uid = `${opts.obligationId}-${opts.periodKey}@xfi.local`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//XML Fiscal Intelligence//Ops Calendar//PT",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${day}`,
    `SUMMARY:${opts.summary.replace(/\n/g, " ")}`,
    `DESCRIPTION:Lembrete de competência (NÃO é vencimento legal). Fonte: ${opts.sourceId}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
