/**
 * Orientação assistida — playbooks + próximos passos.
 * NÃO calcula impostos · NÃO inventa vencimentos/alíquotas.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { HOMOLOGATION_PLAYBOOKS } from "@/modules/homologation/playbooks";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";
import type { GuidedAssistAnswer, MaturityGapHint } from "@/modules/growth/types";
import { pickGroundingSources } from "@/modules/assurance/official-snippets";

/** Padrões que indicam pedido de alíquota/vencimento inventável. */
const FORBIDDEN_TAX_PATTERNS = [
  /\bal[ií]quota\b/i,
  /\btaxa\s*[%％]/i,
  /\b%\s*\d/i,
  /\bvencimento\b/i,
  /\bdue\s*date\b/i,
  /\bprazo\s*(de\s*)?(pagamento|entrega\s*sped)\b/i,
  /\bquando\s+(paga|vence)\b/i,
  /\bquanto\s+(de\s+)?(pis|cofins|icms|ipi|cbs|ibs|irpj|csll)\b/i,
  /\bcalcular?\s+(imposto|tributo|pis|cofins)\b/i,
  /\bsimul(ar|ação)\s+(de\s+)?(imposto|tribut)/i,
];

export function isGuidedAssistEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.FEATURE_GUIDED_ASSIST !== undefined) {
    const v = env.FEATURE_GUIDED_ASSIST;
    return v === "1" || v?.toLowerCase() === "true" || v === "yes";
  }
  return isFeatureEnabled("guidedAssist");
}

export function detectsForbiddenTaxAsk(question: string): boolean {
  return FORBIDDEN_TAX_PATTERNS.some((re) => re.test(question));
}

export function maturityGaps(obligationId: ObligationId): MaturityGapHint {
  const profile = OBLIGATION_SUPPORT_PROFILES[obligationId];
  const gaps = [
    ...(profile?.limitations || []),
    ...(profile?.unsupported || []).slice(0, 3),
  ];
  if (profile && profile.maturity !== "validated_scope" && profile.maturity !== "production") {
    gaps.unshift(`maturidade atual: ${profile.maturity} — sem production global`);
  }
  return {
    obligationId,
    maturity: profile?.maturity || "planned",
    gaps: gaps.length ? gaps : ["sem perfil — ver matriz comercial"],
  };
}

export function nextStepsForObligation(obligationId: ObligationId): string[] {
  const pb = HOMOLOGATION_PLAYBOOKS.find((p) => p.obligationId === obligationId);
  const steps = [
    "Confirme dados mestres e período no cockpit de fechamento",
    "Gere rascunho assistido (não transmite)",
    "Valide no programa oficial (PVA/PGE/ECD/ECF/Reinf) e importe evidência",
    "Revise pacote §28 antes de qualquer claim validated_scope da célula",
  ];
  if (pb) {
    steps.unshift(`Siga o playbook ${pb.id}: ${pb.title}`);
  }
  return steps;
}

const DISCLAIMER =
  "Orientação de processo apenas. Não calcula impostos, não inventa alíquotas/vencimentos, não substitui programas oficiais da RFB.";

export function answerGuidedAssist(input: {
  question: string;
  obligationId?: ObligationId;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): GuidedAssistAnswer {
  if (!isGuidedAssistEnabled(input.env)) {
    return {
      ok: false,
      blocked: true,
      reason: "FEATURE_GUIDED_ASSIST off",
      nextSteps: ["Ative FEATURE_GUIDED_ASSIST=1 após review interno"],
      disclaimer: DISCLAIMER,
    };
  }
  if (detectsForbiddenTaxAsk(input.question)) {
    const cites = pickGroundingSources({
      obligationId: input.obligationId || inferObligation(input.question),
      question: input.question,
    });
    return {
      ok: false,
      blocked: true,
      reason:
        "Pergunta pede alíquota/vencimento/cálculo tributário — recusado (sem inventar tributos)",
      nextSteps: [
        "Consulte legislação/fonte oficial e o programa validador (PVA/PGE/etc.)",
        "Use o playbook de homologação para evidência por cenário",
        "Não use este assistente para simular impostos",
      ],
      disclaimer: DISCLAIMER,
      sourceIds: cites.slice(0, 3).map((c) => c.sourceId),
    };
  }

  const obligationId = input.obligationId || inferObligation(input.question);
  const pb = obligationId
    ? HOMOLOGATION_PLAYBOOKS.find((p) => p.obligationId === obligationId)
    : undefined;
  const gaps = obligationId ? maturityGaps(obligationId).gaps : ["Informe a obrigação (ex.: efd-icms-ipi)"];
  const nextSteps = obligationId
    ? [...nextStepsForObligation(obligationId), ...gaps.slice(0, 2).map((g) => `Gap: ${g}`)]
    : [
        "Especifique a obrigação (EFD ICMS/IPI, Contribuições, ECD, ECF, Reinf)",
        "Abra Homologação → playbook correspondente",
      ];
  const sources = pickGroundingSources({ obligationId, question: input.question });

  return {
    ok: true,
    blocked: false,
    nextSteps,
    playbookId: pb?.id,
    disclaimer: DISCLAIMER,
    sourceIds: sources.map((s) => s.sourceId),
  };
}

function inferObligation(q: string): ObligationId | undefined {
  const s = q.toLowerCase();
  if (/contrib|piscofins|pge/.test(s)) return "efd-contribuicoes";
  if (/icms|ipi|pva/.test(s)) return "efd-icms-ipi";
  if (/\becf\b|e-?lalur/.test(s)) return "ecf";
  if (/\becd\b|cont[aá]bil/.test(s)) return "ecd";
  if (/reinf|r-?\d{4}/.test(s)) return "reinf";
  return undefined;
}

export function listGuidedPlaybookTitles(): string[] {
  return HOMOLOGATION_PLAYBOOKS.map((p) => `${p.id}: ${p.title}`);
}
