/**
 * Responsible AI — masking + provider interface.
 * Never invents CST/CFOP/NCM or writes fiscal records.
 */

export interface SafeAiInput {
  question: string;
  contextSummary?: string;
  consent: boolean;
  enableAi?: boolean;
}

export interface SafeAiResponse {
  answer: string;
  citations: string[];
  limitations: string[];
  confidence: "low" | "medium" | "high";
  needsHumanReview: boolean;
  dataSentDescription: string;
  suggestedFilters?: Record<string, string>;
}

export interface AiProvider {
  chat(input: SafeAiInput): Promise<SafeAiResponse>;
}

const SENSITIVE =
  /\b(\d{44}|[0-9A-Z]{14}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|senha|certificado|pfx|xml\b)/i;

export function maskFiscalText(text: string): string {
  return text
    .replace(/\b\d{44}\b/g, "[CHAVE]")
    .replace(/\b[0-9A-Z]{12}\d{2}\b/gi, "[CNPJ]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]");
}

export function containsSensitiveAiInput(text: string): boolean {
  return SENSITIVE.test(text);
}

export class MockAiProvider implements AiProvider {
  async chat(input: SafeAiInput): Promise<SafeAiResponse> {
    if (!input.consent) {
      return {
        answer: "Consentimento necessário para processar a consulta (mesmo em modo demonstração).",
        citations: [],
        limitations: ["Sem consentimento"],
        confidence: "low",
        needsHumanReview: true,
        dataSentDescription: "Nenhum dado enviado.",
      };
    }
    const maskedQ = maskFiscalText(input.question);
    return {
      answer: [
        "[Demonstração — resposta simulada]",
        "",
        `Pergunta (mascarada): ${maskedQ}`,
        input.contextSummary ? `Contexto: ${maskFiscalText(input.contextSummary)}` : "",
        "",
        "Isto não é parecer fiscal. Use auditoria e o diagnóstico EFD para revisão humana.",
      ]
        .filter(Boolean)
        .join("\n"),
      citations: ["docs/AI_RAG.md", "IndexedDB local"],
      limitations: [
        "Mock não consulta modelo externo",
        "Não altera apuração nem registros EFD",
        "Não inventa CST/CFOP/NCM",
      ],
      confidence: "low",
      needsHumanReview: true,
      dataSentDescription:
        "Dados enviados nesta consulta: nenhum (modo demonstração). Em produção com IA: resumo mascarado apenas.",
      suggestedFilters: guessFilters(input.question),
    };
  }
}

function guessFilters(q: string): Record<string, string> {
  const out: Record<string, string> = {};
  const cfop = q.match(/\b([1-7]\d{3})\b/);
  if (cfop) out.cfop = cfop[1]!;
  if (/sem protocolo/i.test(q)) out.alert = "NO_PROTOCOL";
  return out;
}

export function getAiProvider(): AiProvider {
  // Real providers (OpenAI/xAI) only when ENABLE_AI + keys — not wired to invent tax.
  return new MockAiProvider();
}
