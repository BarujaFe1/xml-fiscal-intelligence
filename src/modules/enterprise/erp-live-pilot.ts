/**
 * ERP live piloto Omie — gated por env; secrets nunca no repo.
 */

import { createCsvAdapter } from "@/modules/continuous-ops/erp/adapter";
import type { ErpNamedAdapter } from "@/modules/continuous-ops/types";
import { LIVE_ERP_ENV_FLAG } from "@/modules/governance/secrets-guard";

/** Fixture piloto (não dados de cliente real). */
export const OMIE_LIVE_PILOT_FIXTURE = `nCodCC;descricao;cCodInt
1001;Receita operacional piloto;omie_pilot_1
2001;Despesa operacional piloto;omie_pilot_2
`;

const OMIE_APP_KEY_ENV = "XFI_OMIE_APP_KEY";
const OMIE_APP_SECRET_ENV = "XFI_OMIE_APP_SECRET";

export function liveErpEnvAllowed(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const v = env[LIVE_ERP_ENV_FLAG];
  return v === "1" || v === "true";
}

export function omieSecretsPresent(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env[OMIE_APP_KEY_ENV]?.trim() && env[OMIE_APP_SECRET_ENV]?.trim());
}

/**
 * Adapter Omie live piloto.
 * liveConnectionEnabled=true somente com XFI_ALLOW_LIVE_ERP + app key/secret em env.
 * Nunca lê/escreve secrets no objeto serializado além do boolean.
 */
export function createOmieLivePilotAdapter(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ErpNamedAdapter {
  const allow = liveErpEnvAllowed(env);
  const secrets = omieSecretsPresent(env);
  const live = allow && secrets;
  return createCsvAdapter({
    vendorId: "omie_live_pilot",
    displayName: live
      ? "Omie live piloto (env autorizada)"
      : "Omie live piloto (gated — off)",
    ndaRequired: true,
    liveConnectionEnabled: live,
    maturity: live ? "internal_beta" : "development",
    domains: ["contrib_entries", "generic", "ledger_accounts"],
    defaultFieldMap: [
      { sourceColumn: "nCodCC", targetField: "code" },
      { sourceColumn: "descricao", targetField: "name" },
      { sourceColumn: "cCodInt", targetField: "idempotencyKey" },
    ],
    notes: [
      "Vendor piloto Fase 12 — NDA/contrato reais antes de cliente",
      `Gate: ${LIVE_ERP_ENV_FLAG}=1 + ${OMIE_APP_KEY_ENV}/${OMIE_APP_SECRET_ENV} em env`,
      "Sem HTTP live neste MVP — preview CSV/golden local; live flag só libera caminho",
      "Secrets nunca commitados",
    ],
    fixtureCsv: OMIE_LIVE_PILOT_FIXTURE,
  });
}

export function runOmieLivePilotGolden(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  ok: boolean;
  okCount: number;
  errorCount: number;
  live: boolean;
  vendorId: string;
} {
  const adapter = createOmieLivePilotAdapter(env);
  const prev = adapter.previewCsv(adapter.syntheticFixtureCsv(), "contrib_entries");
  return {
    ok: prev.errorCount === 0 && prev.okCount >= 2,
    okCount: prev.okCount,
    errorCount: prev.errorCount,
    live: adapter.liveConnectionEnabled,
    vendorId: adapter.vendorId,
  };
}

/** Fetch live — bloqueado até implementação + env; evita claim falso. */
export async function fetchOmieLivePreviewBlocked(): Promise<never> {
  throw new Error(
    "HTTP Omie live não habilitado neste build — use golden CSV + XFI_ALLOW_LIVE_ERP quando contrato/secrets existirem",
  );
}
