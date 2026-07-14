/**
 * Health checks regionais — síntese (sem probe de rede real a RFB).
 */

import type { RegionHealth, RegionId } from "@/modules/scale/types";

const REGION_META: Record<RegionId, { label: string; baseLatency: number }> = {
  local: { label: "Local / browser", baseLatency: 5 },
  gru: { label: "sa-east-1 (GRU synth)", baseLatency: 40 },
  iad: { label: "us-east-1 (IAD synth)", baseLatency: 120 },
};

/**
 * Síntese local — `reachable` reflete configuração env, não uptime cloud medido.
 * XFI_REGION_PRIMARY=gru|iad|local
 */
export function checkRegionHealth(
  regionId: RegionId,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): RegionHealth {
  const meta = REGION_META[regionId];
  const primary = (env.XFI_REGION_PRIMARY || "local").toLowerCase();
  const configured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL) || regionId === "local";
  const isPrimary = primary === regionId || (regionId === "local" && !env.XFI_REGION_PRIMARY);
  return {
    regionId,
    label: meta.label,
    reachable: configured,
    latencyMsEstimate: configured ? meta.baseLatency : null,
    notes: [
      isPrimary ? "primary (synth)" : "secondary (synth)",
      configured ? "config presente" : "supabase URL ausente — degradado",
      "Não mede PVA/RFB",
    ],
    checkedAt: new Date().toISOString(),
  };
}

export function regionalHealthReport(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): RegionHealth[] {
  return (Object.keys(REGION_META) as RegionId[]).map((id) => checkRegionHealth(id, env));
}
