import type { BatchStore } from "@/types";
import type { LocalEstablishmentInput } from "@/modules/obligations/generate-local";

/** Estabelecimento de demonstração (valores fictícios / anonimizados). */
export const DEMO_ESTABLISHMENT: LocalEstablishmentInput = {
  cnpj: "11222333000181",
  ie: "123456789012",
  uf: "SP",
  companyName: "EMPRESA DEMO EMITENTE LTDA",
  profile: "A",
  activityCode: "1",
  purpose: "0",
  periodStart: "2026-03-01",
  periodEnd: "2026-03-31",
  codMun: "3550308",
  tradeName: "EMPRESA DEMO EMITENTE",
  cep: "01310100",
  address: "AV PAULISTA",
  addressNumber: "1000",
  addressCompl: "",
  neighborhood: "BELA VISTA",
  phone: "1133334444",
  email: "demo@empresa.exemplo",
  // Sem CRC → 0100 não é gerado (evita erro de campo obrigatório no PVA)
  accountantName: undefined,
  accountantCpf: undefined,
};

export const DEMO_BATCH_ID = "__demo_sample__";

export type ObligationDemoPayload = {
  establishment: LocalEstablishmentInput;
  store: BatchStore;
  sample: {
    fileName: string;
    documentType: string;
    number?: string;
    totalValue?: number;
    itemCount: number;
  };
  note: string;
};

/** Carrega NF-e de exemplo + dados do estabelecimento para preencher o assistente. */
export async function fetchObligationDemo(): Promise<ObligationDemoPayload> {
  const res = await fetch("/api/obligations/demo/sample");
  const data = (await res.json()) as ObligationDemoPayload & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Falha ao carregar demonstração");
  }
  return data;
}
