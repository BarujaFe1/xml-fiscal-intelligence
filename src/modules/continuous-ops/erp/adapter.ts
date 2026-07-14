/**
 * Interface de adapters ERP nomeados sobre erp-generic.
 */

import {
  previewCsvImport,
  type ErpFieldMap,
  type ErpImportPreview,
} from "@/modules/ops/erp-generic";
import type { ErpNamedAdapter, ErpVendorId } from "@/modules/continuous-ops/types";

export function createCsvAdapter(contract: {
  vendorId: ErpVendorId;
  displayName: string;
  ndaRequired: boolean;
  liveConnectionEnabled: boolean;
  maturity: ErpNamedAdapter["maturity"];
  domains: ErpNamedAdapter["domains"];
  defaultFieldMap: ErpFieldMap[];
  notes: string[];
  fixtureCsv: string;
}): ErpNamedAdapter {
  return {
    ...contract,
    previewCsv(csv, domain) {
      return previewCsvImport(csv, contract.defaultFieldMap, domain);
    },
    syntheticFixtureCsv() {
      return contract.fixtureCsv;
    },
  };
}

/** Placeholders nomeados — sem conexão live (evita claim falso). */
export const PLACEHOLDER_ADAPTERS: ErpNamedAdapter[] = [
  createCsvAdapter({
    vendorId: "totvs_placeholder",
    displayName: "TOTVS (placeholder — requer contrato)",
    ndaRequired: true,
    liveConnectionEnabled: false,
    maturity: "planned",
    domains: ["ledger_accounts", "ledger_entries"],
    defaultFieldMap: [
      { sourceColumn: "COD_CONTA", targetField: "code" },
      { sourceColumn: "DESC_CONTA", targetField: "name" },
      { sourceColumn: "ID_INT", targetField: "idempotencyKey" },
    ],
    notes: ["Sem secrets no repo", "Ativar só com NDA + fixtures do cliente"],
    fixtureCsv: "COD_CONTA;DESC_CONTA;ID_INT\n",
  }),
  createCsvAdapter({
    vendorId: "sap_placeholder",
    displayName: "SAP (placeholder — requer contrato)",
    ndaRequired: true,
    liveConnectionEnabled: false,
    maturity: "planned",
    domains: ["ledger_accounts"],
    defaultFieldMap: [
      { sourceColumn: "SAKNR", targetField: "code" },
      { sourceColumn: "TXT20", targetField: "name" },
      { sourceColumn: "UUID", targetField: "idempotencyKey" },
    ],
    notes: ["Placeholder"],
    fixtureCsv: "SAKNR;TXT20;UUID\n",
  }),
  createCsvAdapter({
    vendorId: "senior_placeholder",
    displayName: "Senior (placeholder — requer contrato)",
    ndaRequired: true,
    liveConnectionEnabled: false,
    maturity: "planned",
    domains: ["generic"],
    defaultFieldMap: [
      { sourceColumn: "codigo", targetField: "code" },
      { sourceColumn: "nome", targetField: "name" },
      { sourceColumn: "id", targetField: "idempotencyKey" },
    ],
    notes: ["Placeholder"],
    fixtureCsv: "codigo;nome;id\n",
  }),
  createCsvAdapter({
    vendorId: "omie_placeholder",
    displayName: "Omie (placeholder — requer contrato)",
    ndaRequired: true,
    liveConnectionEnabled: false,
    maturity: "planned",
    domains: ["contrib_entries", "generic"],
    defaultFieldMap: [
      { sourceColumn: "nCodCC", targetField: "code" },
      { sourceColumn: "descricao", targetField: "name" },
      { sourceColumn: "cCodInt", targetField: "idempotencyKey" },
    ],
    notes: ["Placeholder"],
    fixtureCsv: "nCodCC;descricao;cCodInt\n",
  }),
];

export function listAllAdapters(): ErpNamedAdapter[] {
  return [...PLACEHOLDER_ADAPTERS];
}

/**
 * Adapter é “safe no repo” se não embute secrets literais.
 * Menções a nomes de env (XFI_OMIE_APP_SECRET) nas notes são ok.
 * liveConnectionEnabled pode ser true só para omie/totvs/sap_live_pilot (env validado no registry).
 */
export function assertNoLiveSecretsInAdapter(adapter: ErpNamedAdapter): boolean {
  const blob = JSON.stringify(adapter);
  if (/BEGIN (RSA |EC )?PRIVATE KEY/i.test(blob)) return false;
  // valor atribuído (não só nome de variável)
  if (/app[_-]?secret\s*[:=]\s*['"][^'"]+['"]/i.test(blob)) return false;
  if (/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i.test(blob)) return false;
  if (
    adapter.liveConnectionEnabled &&
    adapter.vendorId !== "omie_live_pilot" &&
    adapter.vendorId !== "totvs_live_pilot" &&
    adapter.vendorId !== "sap_live_pilot"
  ) {
    return false;
  }
  return true;
}
