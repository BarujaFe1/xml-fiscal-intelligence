/**
 * SAP live piloto (3º vendor) — gated por env; HTTP mínimo atrás de flag.
 */

import { createCsvAdapter } from "@/modules/continuous-ops/erp/adapter";
import type { ErpNamedAdapter } from "@/modules/continuous-ops/types";
import { LIVE_ERP_ENV_FLAG } from "@/modules/governance/secrets-guard";
import { liveErpEnvAllowed } from "@/modules/enterprise/erp-live-pilot";
import { erpHttpAllowed } from "@/modules/ecosystem/totvs-live-pilot";

export const SAP_LIVE_PILOT_FIXTURE = `SAKNR;TXT50;EXT_KEY
100000;Caixa SAP piloto;sap_pilot_1
200000;Fornecedores SAP piloto;sap_pilot_2
`;

const SAP_TOKEN_ENV = "XFI_SAP_OAUTH_TOKEN";
export { erpHttpAllowed };

export function sapSecretsPresent(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env[SAP_TOKEN_ENV]?.trim());
}

export function createSapLivePilotAdapter(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ErpNamedAdapter {
  const allow = liveErpEnvAllowed(env);
  const secrets = sapSecretsPresent(env);
  const live = allow && secrets;
  return createCsvAdapter({
    vendorId: "sap_live_pilot",
    displayName: live
      ? "SAP live piloto (env autorizada)"
      : "SAP live piloto (gated — off)",
    ndaRequired: true,
    liveConnectionEnabled: live,
    maturity: live ? "internal_beta" : "development",
    domains: ["ledger_accounts", "ledger_entries", "generic"],
    defaultFieldMap: [
      { sourceColumn: "SAKNR", targetField: "code" },
      { sourceColumn: "TXT50", targetField: "name" },
      { sourceColumn: "EXT_KEY", targetField: "idempotencyKey" },
    ],
    notes: [
      "3º vendor Fase 17 — NDA/contrato antes de cliente",
      `Gate: ${LIVE_ERP_ENV_FLAG}=1 + ${SAP_TOKEN_ENV}`,
      "HTTP mínimo: XFI_ERP_HTTP=1 (default bloqueado)",
      "Secrets nunca commitados",
    ],
    fixtureCsv: SAP_LIVE_PILOT_FIXTURE,
  });
}

export function runSapLivePilotGolden(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  ok: boolean;
  okCount: number;
  errorCount: number;
  live: boolean;
  vendorId: string;
} {
  const adapter = createSapLivePilotAdapter(env);
  const prev = adapter.previewCsv(adapter.syntheticFixtureCsv(), "ledger_accounts");
  return {
    ok: prev.errorCount === 0 && prev.okCount >= 2,
    okCount: prev.okCount,
    errorCount: prev.errorCount,
    live: adapter.liveConnectionEnabled,
    vendorId: adapter.vendorId,
  };
}

/**
 * HTTP client mínimo — só com XFI_ERP_HTTP + live env; caso contrário throws.
 * Não implementa protocolo SAP real (evita claim falso).
 */
export async function fetchSapLiveHttpMinimal(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<{ status: "blocked" | "synth_ok"; detail: string }> {
  if (!liveErpEnvAllowed(env) || !sapSecretsPresent(env)) {
    throw new Error("SAP live HTTP exige XFI_ALLOW_LIVE_ERP + XFI_SAP_OAUTH_TOKEN");
  }
  if (!erpHttpAllowed(env)) {
    throw new Error("HTTP bloqueado — defina XFI_ERP_HTTP=1 após contrato");
  }
  return {
    status: "synth_ok",
    detail: "HTTP path liberado (synth) — sem chamada de rede a SAP neste build",
  };
}
