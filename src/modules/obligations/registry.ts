import type { FiscalObligationPlugin } from "@/modules/obligations/core/types";
import { efdIcmsIpiPlugin } from "@/modules/obligations/efd-icms-ipi/plugin";
import { efdContribuicoesPlugin } from "@/modules/obligations/efd-contribuicoes/plugin";
import { ecdPlugin } from "@/modules/obligations/ecd/plugin";
import { ecfPlugin } from "@/modules/obligations/ecf/plugin";
import { reinfPlugin } from "@/modules/obligations/reinf/plugin";

export type ObligationId =
  | "efd-icms-ipi"
  | "efd-contribuicoes"
  | "ecd"
  | "ecf"
  | "reinf";

export const obligationPlugins: Record<ObligationId, FiscalObligationPlugin> = {
  "efd-icms-ipi": efdIcmsIpiPlugin,
  "efd-contribuicoes": efdContribuicoesPlugin,
  ecd: ecdPlugin,
  ecf: ecfPlugin,
  reinf: reinfPlugin,
};

export const obligationRegistry: Record<ObligationId, "active" | "stub"> = {
  "efd-icms-ipi": "active",
  "efd-contribuicoes": "active",
  ecd: "active",
  ecf: "active",
  reinf: "active",
};

export const OBLIGATION_LABELS: Record<ObligationId, string> = {
  "efd-icms-ipi": "EFD ICMS/IPI (SPED Fiscal)",
  "efd-contribuicoes": "EFD-Contribuições",
  ecd: "ECD",
  ecf: "ECF",
  reinf: "EFD-Reinf",
};

export const OBLIGATION_BLURBS: Record<ObligationId, string> = {
  "efd-icms-ipi": "Geração assistida com prontidão, TXT, manifesto e pré-validação interna.",
  "efd-contribuicoes": "Rascunho PIS/COFINS a partir de NF-e — conferir no PVA EFD-Contribuições.",
  ecd: "Esqueleto contábil com plano DEMO — não deriva lançamentos de XML fiscal.",
  ecf: "Esqueleto estrutural — sem cálculo de IRPJ/CSLL a partir de NF-e.",
  reinf: "Pacote R-1000 + candidatos a eventos — sem transmissão/certificado.",
};

export function getObligationPlugin(id: string): FiscalObligationPlugin | null {
  if (id in obligationPlugins) return obligationPlugins[id as ObligationId];
  return null;
}

export function isObligationId(id: string): id is ObligationId {
  return id in obligationPlugins;
}
