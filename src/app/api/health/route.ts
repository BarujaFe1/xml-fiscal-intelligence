import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { billingIsLive } from "@/lib/billing/provider";
import { getFeatureFlags } from "@/lib/feature-flags";
import { createRequestId } from "@/lib/observability";

export const dynamic = "force-dynamic";

/** Liveness — process is up. */
export async function GET() {
  const requestId = createRequestId();
  return NextResponse.json(
    {
      status: "ok",
      service: "xml-fiscal-intelligence",
      requestId,
      time: new Date().toISOString(),
      // light hints (not readiness)
      supabase: isSupabaseConfigured(),
      billing: billingIsLive(),
      flags: getFeatureFlags(),
    },
    { headers: { "x-request-id": requestId } },
  );
}
