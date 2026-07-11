import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { billingIsLive } from "@/lib/billing/provider";
import { getFeatureFlags } from "@/lib/feature-flags";
import { createRequestId } from "@/lib/observability";

export const dynamic = "force-dynamic";

/** Readiness — configuration posture (no secrets). Always 200 with structured checks. */
export async function GET() {
  const flags = getFeatureFlags();
  const requestId = createRequestId();
  const checks = {
    supabaseConfigured: isSupabaseConfigured(),
    billingLive: billingIsLive(),
    cloudProcessing: flags.cloudProcessing,
    ai: flags.ai,
    efdGeneration: flags.efdGeneration,
  };
  return NextResponse.json(
    {
      status: "ready",
      requestId,
      checks,
      commercialReady: checks.supabaseConfigured && checks.billingLive,
      note: "commercialReady=false until Stripe is live (Supabase may already be configured).",
    },
    { headers: { "x-request-id": requestId } },
  );
}
