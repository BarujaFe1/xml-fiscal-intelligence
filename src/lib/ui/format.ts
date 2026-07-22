/** Presentation helpers — UI-facing Portuguese formatting. */

export function formatDatePtBr(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatDateTimePtBr(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} ${d.toLocaleTimeString(
    "pt-BR",
    { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" },
  )}`;
}

export function formatMoneyPtBr(value?: number | string | null): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Decode HTML entities exactly once for display (e.g. &amp; → &). */
export function decodeHtmlEntitiesOnce(input: string): string {
  if (!input || !input.includes("&")) return input;
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export const PARSE_STATUS_LABEL: Record<string, string> = {
  ok: "Lido",
  warning: "Atenção",
  error: "Erro",
  incomplete: "Incompleto",
};

export function parseStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return PARSE_STATUS_LABEL[status] || status;
}
