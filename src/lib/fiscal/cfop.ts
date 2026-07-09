import type { OperationClassification } from "@/types";

export interface CfopEntry {
  code: string;
  description: string;
  direction: "entrada" | "saida";
  scope: "interno" | "interestadual" | "exterior";
  category: OperationClassification;
  notes?: string;
}

/** Subset versionado de CFOPs comuns — expandir via seed/CSV no futuro. */
export const CFOP_TABLE: CfopEntry[] = [
  { code: "1102", description: "Compra para comercialização", direction: "entrada", scope: "interno", category: "compra" },
  { code: "2102", description: "Compra para comercialização", direction: "entrada", scope: "interestadual", category: "compra" },
  { code: "5102", description: "Venda de mercadoria", direction: "saida", scope: "interno", category: "venda" },
  { code: "6102", description: "Venda de mercadoria", direction: "saida", scope: "interestadual", category: "venda" },
  { code: "5202", description: "Devolução de compra", direction: "saida", scope: "interno", category: "devolucao" },
  { code: "1202", description: "Devolução de venda", direction: "entrada", scope: "interno", category: "devolucao" },
  { code: "5152", description: "Transferência de mercadoria", direction: "saida", scope: "interno", category: "transferencia" },
  { code: "5901", description: "Remessa para industrialização", direction: "saida", scope: "interno", category: "industrializacao" },
  { code: "5910", description: "Remessa em bonificação", direction: "saida", scope: "interno", category: "bonificacao" },
  { code: "5915", description: "Remessa de mercadoria ou bem para consignação", direction: "saida", scope: "interno", category: "consignacao" },
  { code: "5917", description: "Remessa de mercadoria em consignação mercantil ou industrial", direction: "saida", scope: "interno", category: "consignacao" },
  { code: "5949", description: "Outra saída não especificada", direction: "saida", scope: "interno", category: "remessa" },
  { code: "5353", description: "Prestação de serviço de transporte", direction: "saida", scope: "interno", category: "transporte" },
  { code: "6353", description: "Prestação de serviço de transporte", direction: "saida", scope: "interestadual", category: "transporte" },
  { code: "7102", description: "Venda de mercadoria para o exterior", direction: "saida", scope: "exterior", category: "exportacao" },
  { code: "3102", description: "Compra para comercialização — exterior", direction: "entrada", scope: "exterior", category: "importacao" },
];

const byCode = new Map(CFOP_TABLE.map((c) => [c.code, c]));

export function explainCFOP(cfop?: string) {
  if (!cfop) {
    return {
      code: "",
      description: "CFOP ausente",
      category: "desconhecido" as OperationClassification,
      confidence: 0,
      known: false,
    };
  }
  const entry = byCode.get(cfop);
  if (!entry) {
    const prefix = cfop[0];
    const category: OperationClassification =
      prefix === "1" || prefix === "2" || prefix === "3"
        ? "compra"
        : prefix === "5" || prefix === "6" || prefix === "7"
          ? "venda"
          : "desconhecido";
    return {
      code: cfop,
      description: "CFOP não catalogado na tabela local (heurística por dígito)",
      category,
      confidence: 0.4,
      known: false,
    };
  }
  return {
    code: entry.code,
    description: entry.description,
    category: entry.category,
    direction: entry.direction,
    scope: entry.scope,
    confidence: 0.95,
    known: true,
    notes: entry.notes,
  };
}

export function classifyOperation(input: {
  documentType: string;
  cfopMain?: string;
  natureOperation?: string;
}): {
  classification: OperationClassification;
  confidence: number;
  evidence: string[];
  rule: string;
} {
  const evidence: string[] = [];
  if (input.documentType === "CTE") {
    return {
      classification: "transporte",
      confidence: 0.9,
      evidence: ["documentType=CTE"],
      rule: "cte_default",
    };
  }
  if (input.documentType === "NFSE") {
    return {
      classification: "servico",
      confidence: 0.9,
      evidence: ["documentType=NFSE"],
      rule: "nfse_default",
    };
  }
  if (input.cfopMain) {
    const explained = explainCFOP(input.cfopMain);
    evidence.push(`cfop=${input.cfopMain}`);
    if (explained.known) evidence.push(`cfop_table=${explained.description}`);
    return {
      classification: explained.category,
      confidence: explained.confidence,
      evidence,
      rule: explained.known ? "cfop_table" : "cfop_heuristic",
    };
  }
  const nat = (input.natureOperation || "").toLowerCase();
  if (nat.includes("devol")) {
    return {
      classification: "devolucao",
      confidence: 0.7,
      evidence: [`nature=${input.natureOperation}`],
      rule: "nature_keyword",
    };
  }
  if (nat.includes("venda")) {
    return {
      classification: "venda",
      confidence: 0.65,
      evidence: [`nature=${input.natureOperation}`],
      rule: "nature_keyword",
    };
  }
  return {
    classification: "desconhecido",
    confidence: 0.2,
    evidence: ["no_cfop_no_nature"],
    rule: "fallback",
  };
}
