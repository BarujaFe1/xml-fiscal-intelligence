/**
 * Regimes versionados PIS/COFINS — só com sourceId.
 */

import type { ContribRegimeCode, ContribRegimeProfile } from "@/modules/contrib/types";

export const CONTRIB_REGIME_PROFILES: ContribRegimeProfile[] = [
  {
    code: "non_cumulative",
    label: "Não cumulativo",
    effectiveFrom: "2003-01-01",
    sourceId: "official:sped:efd-contribuicoes:hub",
    indCodIncTrib: "1",
    indAproCred: "1",
    indTipoContri: "1",
    indRegCum: "0",
    notes: ["Créditos exigem lançamento explícito no domínio — XML sozinho insuficiente"],
  },
  {
    code: "cumulative",
    label: "Cumulativo",
    effectiveFrom: "2003-01-01",
    sourceId: "official:sped:efd-contribuicoes:hub",
    indCodIncTrib: "2",
    indAproCred: "1",
    indTipoContri: "1",
    indRegCum: "1",
    notes: ["Sem crédito de insumos no modo cumulativo tipificado aqui"],
  },
  {
    code: "cprb",
    label: "CPRB",
    effectiveFrom: "2011-01-01",
    sourceId: "official:sped:efd-contribuicoes:hub",
    indCodIncTrib: "3",
    indAproCred: "1",
    indTipoContri: "1",
    indRegCum: "0",
    notes: ["CPRB exige entradas kind=cprb no domínio"],
  },
  {
    code: "mixed",
    label: "Misto (não tipificado além do 0110)",
    effectiveFrom: "2003-01-01",
    sourceId: "official:sped:efd-contribuicoes:hub",
    indCodIncTrib: "1",
    indAproCred: "2",
    indTipoContri: "1",
    indRegCum: "0",
    notes: ["Misto exige revisão humana dos indicadores 0110"],
  },
];

export function getRegimeProfile(
  code: ContribRegimeCode,
  asOf: string,
): ContribRegimeProfile | null {
  const day = asOf.slice(0, 10);
  const hit = CONTRIB_REGIME_PROFILES.find(
    (p) =>
      p.code === code &&
      p.effectiveFrom <= day &&
      (!p.effectiveTo || p.effectiveTo >= day),
  );
  return hit || null;
}

export function assertRegimeForPeriod(
  code: ContribRegimeCode,
  periodStart: string,
): { ok: boolean; profile?: ContribRegimeProfile; message?: string } {
  const profile = getRegimeProfile(code, periodStart);
  if (!profile) {
    return {
      ok: false,
      message: `Regime ${code} sem perfil vigente para ${periodStart} (falta sourceId/vigência)`,
    };
  }
  if (!profile.sourceId) {
    return { ok: false, message: "Regime sem sourceId — bloqueado" };
  }
  return { ok: true, profile };
}
