/**
 * Piloto sintético nomeado — único adapter `development` com fixture golden.
 * Não é integração live TOTVS/SAP/Omie.
 */

import { createCsvAdapter } from "@/modules/continuous-ops/erp/adapter";
import type { ErpNamedAdapter } from "@/modules/continuous-ops/types";

export const PILOT_SYNTH_FIXTURE = `account_code;account_name;idempotencyKey
1.1.01;Caixa sintetico piloto;pilot_row_1
2.1.01;Fornecedores sintetico;piloto_row_2
`;

/** Conector piloto com colunas estilo ERP genérico brasileiro. */
export const pilotSynthAdapter: ErpNamedAdapter = createCsvAdapter({
  vendorId: "pilot_synth",
  displayName: "Piloto sintético (contrato/NDA placeholder)",
  ndaRequired: true,
  liveConnectionEnabled: false,
  maturity: "development",
  domains: ["ledger_accounts", "generic"],
  defaultFieldMap: [
    { sourceColumn: "account_code", targetField: "code" },
    { sourceColumn: "account_name", targetField: "name" },
    { sourceColumn: "idempotencyKey", targetField: "idempotencyKey" },
  ],
  notes: [
    "Golden synth no repo — zero dados reais de cliente",
    "liveConnectionEnabled=false até contrato + secrets em env",
  ],
  fixtureCsv: PILOT_SYNTH_FIXTURE,
});

export function runPilotGoldenPreview(): {
  ok: boolean;
  okCount: number;
  errorCount: number;
  vendorId: string;
} {
  const prev = pilotSynthAdapter.previewCsv(
    pilotSynthAdapter.syntheticFixtureCsv(),
    "ledger_accounts",
  );
  return {
    ok: prev.errorCount === 0 && prev.okCount >= 2,
    okCount: prev.okCount,
    errorCount: prev.errorCount,
    vendorId: pilotSynthAdapter.vendorId,
  };
}
