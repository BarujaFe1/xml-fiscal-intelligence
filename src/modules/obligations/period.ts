/** Calendar helpers for obligation periods (local YYYY-MM-DD, no inventing fiscal facts). */

export function lastDayOfMonth(year: number, month: number): number {
  // month is 1-12; Date.UTC day 0 of next month = last day of this month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function periodBoundsFromYearMonth(year: number, month: number): {
  periodStart: string;
  periodEnd: string;
} {
  const m = String(month).padStart(2, "0");
  const last = lastDayOfMonth(year, month);
  return {
    periodStart: `${year}-${m}-01`,
    periodEnd: `${year}-${m}-${String(last).padStart(2, "0")}`,
  };
}
