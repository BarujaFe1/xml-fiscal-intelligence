export interface SpedNode {
  id: string;
  label: string;
  status: "ok" | "missing" | "derived" | "na" | "warning";
  xmlPath?: string;
  notes?: string;
  children?: SpedNode[];
}

/**
 * SPED Fiscal tree preview — diagnóstico/simulação, NÃO substitui PVA.
 */
export function buildSpedPreviewTree(input: {
  hasNfe: boolean;
  hasItems: boolean;
  hasCfop: boolean;
  hasNcm: boolean;
  companyConfigured: boolean;
}): SpedNode {
  return {
    id: "sped",
    label: "SPED Fiscal ICMS/IPI (preview)",
    status: "warning",
    notes: "Simulação/diagnóstico — não é escrituração oficial.",
    children: [
      {
        id: "0",
        label: "Bloco 0 — Cadastros",
        status: input.companyConfigured ? "ok" : "missing",
        notes: input.companyConfigured
          ? "Empresa configurada no workspace"
          : "Cadastro da empresa incompleto no app",
        children: [
          {
            id: "0000",
            label: "0000 — Abertura",
            status: input.companyConfigured ? "derived" : "missing",
            notes: "Exige CNPJ/IE/período da empresa",
          },
          {
            id: "0150",
            label: "0150 — Participantes",
            status: "derived",
            xmlPath: "emit/dest CNPJ",
            notes: "Derivado de emitentes/destinatários do lote",
          },
          {
            id: "0200",
            label: "0200 — Itens",
            status: input.hasItems ? "derived" : "missing",
            xmlPath: "det/prod",
          },
        ],
      },
      {
        id: "C",
        label: "Bloco C — Documentos fiscais",
        status: input.hasNfe ? "ok" : "na",
        children: [
          {
            id: "C100",
            label: "C100 — Nota fiscal",
            status: input.hasNfe ? "derived" : "missing",
            xmlPath: "ide/emit/dest/total",
            notes: "Mapeamento preliminar a partir de NF-e",
          },
          {
            id: "C170",
            label: "C170 — Itens",
            status: input.hasItems && input.hasNcm && input.hasCfop ? "derived" : "warning",
            xmlPath: "det/prod/imposto",
            notes: "Não gerar C170 indiscriminadamente — revisar CST/CFOP",
          },
          {
            id: "C190",
            label: "C190 — Analítico",
            status: input.hasCfop ? "derived" : "missing",
            notes: "Agregação por CST/CFOP/alíquota (heurística)",
          },
        ],
      },
      {
        id: "9",
        label: "Bloco 9 — Controle",
        status: "derived",
        notes: "Contadores derivados do preview",
      },
    ],
  };
}
