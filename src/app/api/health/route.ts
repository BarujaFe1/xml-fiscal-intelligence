import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { billingIsLive } from "@/lib/billing/provider";
import { getFeatureFlags } from "@/lib/feature-flags";
import { createRequestId } from "@/lib/observability";
import { getReleaseInfo } from "@/lib/release";

export const dynamic = "force-dynamic";

/** Liveness — process is up. */
export async function GET() {
  const requestId = createRequestId();
  const release = getReleaseInfo();
  return NextResponse.json(
    {
      status: "ok",
      service: "xml-fiscal-intelligence",
      requestId,
      time: new Date().toISOString(),
      version: release.appVersion,
      commit: release.buildCommit,
      channel: release.channel,
      supabase: isSupabaseConfigured(),
      billing: billingIsLive(),
      flags: getFeatureFlags(),
    },
    { headers: { "x-request-id": requestId } },
  );
}
