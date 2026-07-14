export type ObligationId =
  | "efd-icms-ipi"
  | "efd-contribuicoes"
  | "ecd"
  | "ecf"
  | "reinf";

export const OBLIGATION_IDS: ObligationId[] = [
  "efd-icms-ipi",
  "efd-contribuicoes",
  "ecd",
  "ecf",
  "reinf",
];

export const OBLIGATION_LABELS: Record<ObligationId, string> = {
  "efd-icms-ipi": "EFD ICMS/IPI (SPED Fiscal)",
  "efd-contribuicoes": "EFD-Contribuições",
  ecd: "ECD",
  ecf: "ECF",
  reinf: "EFD-Reinf",
};

export const OBLIGATION_BLURBS: Record<ObligationId, string> = {
  "efd-icms-ipi": "Geração assistida com prontidão, TXT, manifesto e pré-validação interna.",
  "efd-contribuicoes": "Rascunho PIS/COFINS a partir de NF-e — conferir no PGE oficial.",
  ecd: "Motor contábil + ECD (ledger). DEMO só com extras.ecdMode=demo — XML não gera I200.",
  ecf: "Esqueleto estrutural — sem cálculo de IRPJ/CSLL a partir de NF-e.",
  reinf: "Motor de eventos (draft XML + lifecycle). Submit off por padrão; assinatura só via agente local.",
};

export function isObligationId(id: string): id is ObligationId {
  return (OBLIGATION_IDS as string[]).includes(id);
}
