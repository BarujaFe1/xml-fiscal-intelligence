/**
 * SP — plugin com Tabela de Códigos de Receita oficial (Portaria CAT 147/2009, Anexo IX).
 * Usada no E116 (COD_REC) para ICMS – Operações Próprias.
 * Código inclui dígito verificador com hífen (ex.: "046-2"), conforme exige o PVA.
 */
import type { EfdUfPlugin } from "@/modules/obligations/efd-icms-ipi/uf/types";

const SP_COD_REC_SRC = "Portaria CAT 147/2009 Anexo IX (SEFAZ-SP)";

export const ufSpPlugin: EfdUfPlugin = {
  uf: "SP",
  icmsCodRecTable: [
    { code: "046-2", label: "ICMS – Regime Periódico de Apuração (RPA)", sourceId: SP_COD_REC_SRC },
    { code: "060-7", label: "ICMS – Regime de Estimativa", sourceId: SP_COD_REC_SRC },
    { code: "063-2", label: "ICMS – Outros recolhimentos especiais", sourceId: SP_COD_REC_SRC },
    { code: "075-9", label: "ICMS – Dívida ativa (cobrança amigável)", sourceId: SP_COD_REC_SRC },
    { code: "078-4", label: "ICMS – Dívida ativa ajuizada", sourceId: SP_COD_REC_SRC },
    { code: "081-4", label: "ICMS – Parcelamento de débito fiscal não inscrito", sourceId: SP_COD_REC_SRC },
    { code: "087-5", label: "ICMS – Programa de Parcelamento Incentivado (PPI)", sourceId: SP_COD_REC_SRC },
    { code: "089-9", label: "ICMS – Programa Especial de Parcelamento (PEP)", sourceId: SP_COD_REC_SRC },
    { code: "100-4", label: "ICMS recolhimento antecipado (outra UF)", sourceId: SP_COD_REC_SRC },
    { code: "106-5", label: "Mercadorias destinadas a consumo ou ativo imobilizado", sourceId: SP_COD_REC_SRC },
    { code: "114-4", label: "Energia elétrica (no Estado de São Paulo)", sourceId: SP_COD_REC_SRC },
    { code: "117-0", label: "Combustível (no Estado de São Paulo)", sourceId: SP_COD_REC_SRC },
  ],
  adjustmentCodes: [],
  suggestIcmsCodRec() {
    // Default: Regime Periódico de Apuração (RPA) — COD_REC "046-2".
    return "046-2";
  },
};
