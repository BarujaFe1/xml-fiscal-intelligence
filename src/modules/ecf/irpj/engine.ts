/**
 * Motor IRPJ/CSLL — gated. Sem FEATURE_ECF_IRPJ_ENGINE não calcula impostos.
 * Nunca deriva IRPJ de XML fiscal.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import type { ElalurSnapshot, IrpjCsllComputation } from "@/modules/ecf/types";
import { sumPartA } from "@/modules/ecf/elalur/model";

export type IrpjEngineInput = {
  periodKey: string;
  /** Lucro contábil / base informada (string decimal BR), nunca inventada de NF-e */
  accountingProfit?: string;
  elalur?: ElalurSnapshot;
  /** Memória anual informada (estimativas) — só usada com flag on */
  memory?: Array<{ periodKey: string; amount: string }>;
};

function parseAmt(s?: string): number {
  if (!s) return 0;
  return Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
}

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/**
 * Determinístico quando habilitado: base = lucro ± adições/exclusões (Parte A).
 * Alíquotas e adicionais NÃO são inventados — exigem extras/rates explícitos ou ficam zerados com warning.
 */
export function computeIrpjCsll(
  input: IrpjEngineInput,
  opts?: { forceEnable?: boolean; irpjRate?: number; csllRate?: number },
): IrpjCsllComputation {
  const enabled =
    opts?.forceEnable === true ||
    (typeof process !== "undefined" && isFeatureEnabled("ecfIrpjEngine"));

  if (!enabled) {
    return {
      enabled: false,
      gatedReason:
        "FEATURE_ECF_IRPJ_ENGINE off — sem cálculo IRPJ/CSLL até evidência Programa ECF + revisor",
      lines: [],
      warnings: ["Cálculo IRPJ/CSLL bloqueado por feature flag"],
    };
  }

  const warnings: string[] = [];
  const profit = parseAmt(input.accountingProfit);
  if (!input.accountingProfit) {
    warnings.push("accountingProfit ausente — base zero (não inventado)");
  }
  const part = input.elalur ? sumPartA(input.elalur.partA) : { additions: 0, exclusions: 0, compensations: 0 };
  const baseIrpj = Math.max(0, profit + part.additions - part.exclusions - part.compensations);
  const baseCsll = baseIrpj;
  const irpjRate = opts?.irpjRate;
  const csllRate = opts?.csllRate;
  if (irpjRate == null || csllRate == null) {
    warnings.push("Alíquotas não informadas — valores de imposto zerados (não inventar alíquota)");
  }
  const irpj = irpjRate != null ? baseIrpj * irpjRate : 0;
  const csll = csllRate != null ? baseCsll * csllRate : 0;

  return {
    enabled: true,
    lines: [
      {
        periodKey: input.periodKey,
        baseIrpj: fmt(baseIrpj),
        irpj: fmt(irpj),
        baseCsll: fmt(baseCsll),
        csll: fmt(csll),
        notes: "Motor gated — validar no Programa ECF antes de qualquer claim",
      },
    ],
    warnings,
  };
}

export function isEcfIrpjEngineEnabled(): boolean {
  return isFeatureEnabled("ecfIrpjEngine");
}
