/**
 * SP — placeholder plugin.
 * COD_REC / ajustes: preenchidos somente após tabela oficial da SEFAZ-SP registrada no catálogo.
 * Não sugerir códigos inventados.
 */
import type { EfdUfPlugin } from "@/modules/obligations/efd-icms-ipi/uf/types";

export const ufSpPlugin: EfdUfPlugin = {
  uf: "SP",
  icmsCodRecTable: [],
  adjustmentCodes: [],
  suggestIcmsCodRec() {
    // Sem seed oficial → não inventar
    return undefined;
  },
};
