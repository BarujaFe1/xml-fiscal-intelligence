/**
 * Timezone / periodKey helpers — documentação operacional.
 * Não interpreta calendários fiscais estrangeiros.
 */

/** PeriodKey mensal YYYY-MM no fuso informado (default America/Sao_Paulo via offset fixo -03 quando Intl falha). */
export function periodKeyMonthly(
  date = new Date(),
  timeZone = "America/Sao_Paulo",
): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    });
    const parts = fmt.formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    if (y && m) return `${y}-${m}`;
  } catch {
    /* fallthrough */
  }
  return date.toISOString().slice(0, 7);
}

export function periodKeyAnnual(date = new Date(), timeZone = "America/Sao_Paulo"): string {
  return periodKeyMonthly(date, timeZone).slice(0, 4);
}

/** Lista timezones “conhecidas” para UI — sem validar calendário fiscal. */
export const KNOWN_TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Noronha",
  "UTC",
] as const;

export function timezoneHelpersMarkdown(): string {
  return [
    "# Timezone / periodKey helpers",
    "",
    "- Default: `America/Sao_Paulo`",
    "- `periodKeyMonthly` → `YYYY-MM`",
    "- `periodKeyAnnual` → `YYYY`",
    "",
    "## Fora de escopo",
    "- Calendários fiscais de outros países",
    "- Feriados / vencimentos inventados",
    "",
    "Código: `src/modules/compliance/timezone.ts`",
  ].join("\n");
}
