/**
 * Assist grounded — respostas só com sourceIds do catálogo oficial.
 * FEATURE_GUIDED_ASSIST permanece default-off.
 */

import {
  answerGuidedAssist,
  detectsForbiddenTaxAsk,
  isGuidedAssistEnabled,
} from "@/modules/growth/guided-assist";
import { pickGroundingSources } from "@/modules/assurance/official-snippets";
import type { GroundedAssistAnswer } from "@/modules/assurance/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { GuidedAssistAnswer } from "@/modules/growth/types";

const DISCLAIMER =
  "Orientação grounded em fontes oficiais catalogadas. Não calcula impostos, não inventa alíquotas/vencimentos.";

function inferObligation(q: string): ObligationId | undefined {
  const s = q.toLowerCase();
  if (/contrib|piscofins|pge/.test(s)) return "efd-contribuicoes";
  if (/icms|ipi|pva/.test(s)) return "efd-icms-ipi";
  if (/\becf\b|e-?lalur/.test(s)) return "ecf";
  if (/\becd\b|cont[aá]bil/.test(s)) return "ecd";
  if (/reinf|r-?\d{4}/.test(s)) return "reinf";
  return undefined;
}

/**
 * Resposta grounded: exige sourceIds[] não vazio quando ok; bloquia claims tributários.
 */
export function answerGroundedAssist(input: {
  question: string;
  obligationId?: ObligationId;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): GroundedAssistAnswer {
  const base = answerGuidedAssist(input);
  const obligationId = input.obligationId || inferObligation(input.question);
  const snippets = pickGroundingSources({
    obligationId,
    question: input.question,
  });
  const sourceIds = snippets.map((s) => s.sourceId);
  const citations = snippets.map((s) => ({
    sourceId: s.sourceId,
    title: s.title,
    url: s.url,
  }));

  if (base.blocked) {
    // Bloqueio tributário ainda precisa citar fontes oficiais quando possível
    return {
      ...base,
      disclaimer: DISCLAIMER,
      sourceIds: sourceIds.length ? sourceIds.slice(0, 3) : [],
      citations: citations.slice(0, 3),
      nextSteps: [
        ...base.nextSteps,
        ...(citations[0]
          ? [`Fonte: ${citations[0].title} (${citations[0].url})`]
          : ["Consulte o catálogo OFFICIAL_SOURCE_CATALOG"]),
      ],
    };
  }

  if (!sourceIds.length) {
    return {
      ok: false,
      blocked: true,
      reason: "Sem fontes oficiais indexed — resposta grounded bloqueada",
      nextSteps: [
        "Selecione uma obrigação suportada no catálogo oficial",
        "Atualize OFFICIAL_SOURCE_CATALOG com URL verificada",
      ],
      disclaimer: DISCLAIMER,
      sourceIds: [],
      citations: [],
    };
  }

  return {
    ok: true,
    blocked: false,
    nextSteps: [
      ...base.nextSteps,
      "Abra as URLs citadas no portal oficial antes de validar no PVA/PGE",
    ],
    playbookId: base.playbookId,
    disclaimer: DISCLAIMER,
    sourceIds,
    citations,
  };
}

/** Enriquece GuidedAssistAnswer com sourceIds (compat F16 UI). */
export function withGroundingSourceIds(answer: GuidedAssistAnswer, question: string, obligationId?: ObligationId): GuidedAssistAnswer {
  if (answer.blocked && detectsForbiddenTaxAsk(question)) {
    const snippets = pickGroundingSources({ obligationId, question });
    return { ...answer, sourceIds: snippets.slice(0, 3).map((s) => s.sourceId) };
  }
  if (!answer.ok) return answer;
  const snippets = pickGroundingSources({ obligationId: obligationId || inferObligation(question), question });
  if (!snippets.length) {
    return {
      ...answer,
      ok: false,
      blocked: true,
      reason: "Sem sourceIds — grounding obrigatório (F17)",
      sourceIds: [],
    };
  }
  return { ...answer, sourceIds: snippets.map((s) => s.sourceId) };
}

export { isGuidedAssistEnabled, detectsForbiddenTaxAsk };
