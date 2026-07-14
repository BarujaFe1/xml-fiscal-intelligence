/**
 * RTC follow-through — ativar rule_set só com fixture explícita (nunca cedo).
 */

import { RTC_RULE_SET_VERSIONS } from "@/modules/rtc/rule-sets";
import type { RtcRuleSetVersion } from "@/modules/rtc/types";

export type RtcActivationRequest = {
  ruleSetId: string;
  fixtureId: string;
  reviewerId: string;
  evidenceHash: string;
};

/**
 * Retorna cópia ativada em memória para lab — NÃO muta o catálogo commitado.
 * Exige fixture + reviewer + hash.
 */
export function activateRtcRuleSetWithFixture(
  req: RtcActivationRequest,
): { ok: boolean; rule?: RtcRuleSetVersion; reason?: string } {
  const base = RTC_RULE_SET_VERSIONS.find((r) => r.id === req.ruleSetId);
  if (!base) return { ok: false, reason: "rule_set não encontrado" };
  if (!req.fixtureId.trim()) return { ok: false, reason: "fixtureId obrigatório" };
  if (!req.reviewerId.trim()) return { ok: false, reason: "reviewerId obrigatório" };
  if (!req.evidenceHash || req.evidenceHash.length < 16) {
    return { ok: false, reason: "evidenceHash insuficiente" };
  }
  return {
    ok: true,
    rule: {
      ...base,
      activated: true,
      notes: [
        ...base.notes,
        `ativada em lab com fixture=${req.fixtureId} reviewer=${req.reviewerId} hash=${req.evidenceHash.slice(0, 12)}`,
        "Catálogo static permanece activated=false até merge deliberado",
      ],
    },
  };
}

export function assertStaticRtcRulesInactive(): boolean {
  return RTC_RULE_SET_VERSIONS.every((r) => r.activated === false);
}
