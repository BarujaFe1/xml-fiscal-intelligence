/**
 * NTs / rule_set_versions — catalogadas; activated=false até fixture + lab.
 */

import type { RuleSetVersion } from "@/modules/contrib/types";

export const CONTRIB_RULE_SET_VERSIONS: RuleSetVersion[] = [
  {
    id: "rs_efd_contrib_nt_11_2026",
    obligationId: "efd-contribuicoes",
    code: "NT_11_2026",
    versionLabel: "descontinuidade-orientacoes",
    sourceId: "official:efd-contribuicoes:nt-11-2026",
    effectiveFrom: "2026-01-01",
    impactManifest: [
      "Orientação de descontinuidade gradual EFD-Contribuições",
      "Preservar modo historical_and_credit_management",
      "Não auto-migrar saldos sem fixture",
    ],
    activated: false,
    notes: ["Ativar só com fixture + evidência PGE + revisor"],
  },
  {
    id: "rs_efd_contrib_nt_12_2026",
    obligationId: "efd-contribuicoes",
    code: "NT_12_2026",
    versionLabel: "reducao-linear-lc224",
    sourceId: "official:efd-contribuicoes:nt-12-2026",
    effectiveFrom: "2026-01-01",
    impactManifest: [
      "Redução linear de incentivos/benefícios (LC 224) — impacto em créditos/ajustes",
      "Exige entradas kind=adjustment explícitas; sem inventar redução",
    ],
    activated: false,
    notes: ["Não hardcodar percentuais — informar via domínio/ajuste"],
  },
];

export function listRuleSets(asOf?: string): RuleSetVersion[] {
  if (!asOf) return CONTRIB_RULE_SET_VERSIONS;
  const day = asOf.slice(0, 10);
  return CONTRIB_RULE_SET_VERSIONS.filter(
    (r) => r.effectiveFrom <= day && (!r.effectiveTo || r.effectiveTo >= day),
  );
}

export function activatedRuleImpacts(asOf: string): string[] {
  return listRuleSets(asOf)
    .filter((r) => r.activated)
    .flatMap((r) => r.impactManifest.map((m) => `[${r.code}] ${m}`));
}

/** Impacto informativo (mesmo com activated=false) para manifesto/disclaimer. */
export function cataloguedRuleImpacts(asOf: string): string[] {
  return listRuleSets(asOf).flatMap((r) =>
    r.impactManifest.map(
      (m) => `[${r.code}${r.activated ? "" : " catalog"}] ${m}`,
    ),
  );
}
