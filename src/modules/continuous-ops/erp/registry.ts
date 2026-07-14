/**
 * Registry de adapters — piloto + placeholders + Omie (F12) + TOTVS (F14) + SAP (F17) gated.
 */

import { PLACEHOLDER_ADAPTERS, assertNoLiveSecretsInAdapter } from "@/modules/continuous-ops/erp/adapter";
import { pilotSynthAdapter } from "@/modules/continuous-ops/erp/pilot";
import { createOmieLivePilotAdapter } from "@/modules/enterprise/erp-live-pilot";
import { createTotvsLivePilotAdapter } from "@/modules/ecosystem/totvs-live-pilot";
import { createSapLivePilotAdapter } from "@/modules/assurance/sap-live-pilot";
import { assertNoLiveErpWithoutEnv } from "@/modules/governance/secrets-guard";
import type { ErpNamedAdapter, ErpVendorId } from "@/modules/continuous-ops/types";

export function listRegisteredAdapters(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ErpNamedAdapter[] {
  return [
    pilotSynthAdapter,
    ...PLACEHOLDER_ADAPTERS,
    createOmieLivePilotAdapter(env),
    createTotvsLivePilotAdapter(env),
    createSapLivePilotAdapter(env),
  ];
}

export function getAdapter(
  vendorId: ErpVendorId,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ErpNamedAdapter | undefined {
  return listRegisteredAdapters(env).find((a) => a.vendorId === vendorId);
}

export function assertCatalogSafe(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const adapters = listRegisteredAdapters(env);
  const adaptersOk = adapters.every((a) => assertNoLiveSecretsInAdapter(a));
  return adaptersOk && assertNoLiveErpWithoutEnv(env, adapters).ok;
}
