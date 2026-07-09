export type AiProvider = "mock" | "openai" | "xai";

export interface AiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AiChatResult {
  answer: string;
  citations: string[];
  limitations: string[];
  generatedSql?: string;
  suggestedFilters?: Record<string, string>;
}

/**
 * AI/RAG mock — nunca envia dados a providers externos sem ENABLE_AI + keys.
 */
export async function chatFiscalAi(input: {
  question: string;
  contextSummary?: string;
  enableAi?: boolean;
  provider?: AiProvider;
}): Promise<AiChatResult> {
  const enable = input.enableAi ?? process.env.ENABLE_AI === "true";
  if (!enable || (input.provider || process.env.AI_PROVIDER || "mock") === "mock") {
    return {
      answer: [
        "Modo mock ativo. Com base no contexto local (sem chamar API externa):",
        "",
        `Pergunta: ${input.question}`,
        input.contextSummary ? `Contexto: ${input.contextSummary}` : "",
        "",
        "Sugestão: use filtros por CFOP/NCM/CNPJ no dashboard ou a busca global.",
        "Para IA real, configure AI_PROVIDER e a API key correspondente, com ENABLE_DATA_MASKING=true.",
      ]
        .filter(Boolean)
        .join("\n"),
      citations: ["IndexedDB/local batch store", "docs/AI_RAG.md"],
      limitations: [
        "Não é parecer fiscal.",
        "Mock não consulta modelo externo.",
        "Sempre revise achados de auditoria manualmente.",
      ],
      suggestedFilters: guessFilters(input.question),
    };
  }

  return {
    answer: "Provider externo não implementado neste upgrade — use mock.",
    citations: [],
    limitations: ["Provider real pendente"],
  };
}

function guessFilters(q: string): Record<string, string> {
  const out: Record<string, string> = {};
  const cfop = q.match(/\b([1-7]\d{3})\b/);
  if (cfop) out.cfop = cfop[1];
  if (/sem protocolo/i.test(q)) out.alert = "NO_PROTOCOL";
  if (/duplic/i.test(q)) out.alert = "DUPLICATES";
  if (/ncm/i.test(q) && /sem|falt/i.test(q)) out.alert = "NO_NCM";
  return out;
}

/** Only allow SELECT — reject anything else. */
export function assertSafeSelectSql(sql: string): { ok: boolean; reason?: string } {
  const normalized = sql.trim().replace(/\s+/g, " ");
  if (!/^select\b/i.test(normalized)) {
    return { ok: false, reason: "Apenas SELECT é permitido" };
  }
  if (/\b(insert|update|delete|drop|alter|truncate|grant|revoke|create)\b/i.test(normalized)) {
    return { ok: false, reason: "SQL destrutivo bloqueado" };
  }
  return { ok: true };
}
