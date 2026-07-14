/**
 * TOTVS live piloto (2º vendor) — gated por env; HTTP mínimo atrás de flag.
 */

import { createCsvAdapter } from "@/modules/continuous-ops/erp/adapter";
import type { ErpNamedAdapter } from "@/modules/continuous-ops/types";
import { LIVE_ERP_ENV_FLAG } from "@/modules/governance/secrets-guard";
import { liveErpEnvAllowed } from "@/modules/enterprise/erp-live-pilot";
import { checkRehomologation } from "@/modules/continuous-ops/rehomologation";
import type { ValidatedScenario } from "@/modules/homologation/types";

export const TOTVS_LIVE_PILOT_FIXTURE = `COD_CONTA;DESC_CONTA;ID_INT
1.1.01;Caixa TOTVS piloto;totvs_pilot_1
2.1.01;Fornecedores TOTVS piloto;totvs_pilot_2
`;

const TOTVS_TOKEN_ENV = "XFI_TOTVS_ACCESS_TOKEN";
export const ERP_HTTP_FLAG = "XFI_ERP_HTTP";

export function totvsSecretsPresent(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env[TOTVS_TOKEN_ENV]?.trim());
}

export function erpHttpAllowed(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const v = env[ERP_HTTP_FLAG];
  return v === "1" || v === "true";
}

export function createTotvsLivePilotAdapter(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ErpNamedAdapter {
  const allow = liveErpEnvAllowed(env);
  const secrets = totvsSecretsPresent(env);
  const live = allow && secrets;
  return createCsvAdapter({
    vendorId: "totvs_live_pilot",
    displayName: live
      ? "TOTVS live piloto (env autorizada)"
      : "TOTVS live piloto (gated — off)",
    ndaRequired: true,
    liveConnectionEnabled: live,
    maturity: live ? "internal_beta" : "development",
    domains: ["ledger_accounts", "ledger_entries", "generic"],
    defaultFieldMap: [
      { sourceColumn: "COD_CONTA", targetField: "code" },
      { sourceColumn: "DESC_CONTA", targetField: "name" },
      { sourceColumn: "ID_INT", targetField: "idempotencyKey" },
    ],
    notes: [
      "2º vendor Fase 14 — NDA/contrato antes de cliente",
      `Gate: ${LIVE_ERP_ENV_FLAG}=1 + ${TOTVS_TOKEN_ENV}`,
      `HTTP mínimo: ${ERP_HTTP_FLAG}=1 (default bloqueado)`,
      "Secrets nunca commitados",
    ],
    fixtureCsv: TOTVS_LIVE_PILOT_FIXTURE,
  });
}

export function runTotvsLivePilotGolden(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  ok: boolean;
  okCount: number;
  errorCount: number;
  live: boolean;
  vendorId: string;
} {
  const adapter = createTotvsLivePilotAdapter(env);
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
 * Não implementa protocolo TOTVS real (evita claim falso).
 */
export async function fetchTotvsLiveHttpMinimal(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<{ status: "blocked" | "synth_ok"; detail: string }> {
  if (!liveErpEnvAllowed(env) || !totvsSecretsPresent(env)) {
    throw new Error("TOTVS live HTTP exige XFI_ALLOW_LIVE_ERP + XFI_TOTVS_ACCESS_TOKEN");
  }
  if (!erpHttpAllowed(env)) {
    throw new Error(`HTTP bloqueado — defina ${ERP_HTTP_FLAG}=1 após contrato`);
  }
  // Sem rede real: resposta sintética honesta
  return {
    status: "synth_ok",
    detail: "HTTP path liberado (synth) — sem chamada de rede a TOTVS neste build",
  };
}

/** Pós-conexão: lembrar rehomologação dos cenários do workspace. */
export function postConnectionRehomologationReminders(
  scenarios: ValidatedScenario[],
  opts?: { now?: Date },
): Array<{ scenarioId: string; action: string }> {
  return scenarios.map((s) => {
    const c = checkRehomologation(s, { now: opts?.now });
    return { scenarioId: s.id, action: c.action };
  });
}
