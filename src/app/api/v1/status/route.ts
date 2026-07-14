import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/modules/ops/api-auth";
import { PLATFORM_OPS_CAPABILITIES, PLATFORM_OPS_MATURITY } from "@/modules/ops/platform";
import { obligationRegistry, OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { recordOpsEvent } from "@/modules/ops/telemetry";
import { createRequestId } from "@/lib/observability";
import { continuousOpsHealth } from "@/modules/continuous-ops/platform";
import {
  assertWithinQuota,
  bumpUsage,
  defaultQuotaPolicy,
  hourBucket,
} from "@/modules/continuous-ops/multi-company";
import { regionalHealthReport } from "@/modules/scale/regions";
import { scaleHealth } from "@/modules/scale/platform";
import { defaultDrTargets } from "@/modules/scale/dr";
import { billingEnterpriseEnabled } from "@/modules/scale/billing-plans";
import { ecosystemHealth } from "@/modules/ecosystem/platform";
import { computeSloSnapshot, seedStagingApiStatusSamples } from "@/modules/ecosystem/slo";
import { complianceHealth } from "@/modules/compliance/platform";
import { formatPackVersion } from "@/modules/compliance/pack";
import { growthHealth } from "@/modules/growth/platform";
import { isGuidedAssistEnabled } from "@/modules/growth/guided-assist";
import { assuranceHealth } from "@/modules/assurance/platform";

export const dynamic = "force-dynamic";

/** Ephemeral process quota for API (serverless resets — documental). */
const usageByWs = new Map<
  string,
  { generationsThisHour: number; apiCallsThisHour: number; hourBucket: string }
>();

export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  const auth = authenticateApiKey(req);
  if (!auth.ok) {
    recordOpsEvent("api_denied", auth.error);
    return NextResponse.json(
      { error: auth.error, requestId },
      { status: auth.status, headers: { "x-request-id": requestId } },
    );
  }
  const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "ws_api";
  const policy = defaultQuotaPolicy(workspaceId);
  let usage = usageByWs.get(workspaceId) || {
    generationsThisHour: 0,
    apiCallsThisHour: 0,
    hourBucket: hourBucket(),
  };
  const gate = assertWithinQuota(policy, usage, "api");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, requestId },
      { status: 429, headers: { "x-request-id": requestId } },
    );
  }
  usage = bumpUsage(usage, "api");
  usageByWs.set(workspaceId, usage);

  const continuous = continuousOpsHealth();
  const scale = scaleHealth();
  const regions = regionalHealthReport();
  const dr = defaultDrTargets();
  const ecosystem = ecosystemHealth();
  const compliance = await complianceHealth();
  const growth = growthHealth();
  const assurance = assuranceHealth();
  const stagingSlo = computeSloSnapshot(
    "api_status_availability",
    seedStagingApiStatusSamples(100),
  );
  return NextResponse.json(
    {
      status: "ok",
      platformMaturity: PLATFORM_OPS_MATURITY,
      continuousOps: continuous,
      scale: {
        maturity: scale.maturity,
        regions,
        dr: { rpoHours: dr.rpoHours, rtoHours: dr.rtoHours, outOfScope: dr.outOfScope },
        billingEnterpriseFlag: billingEnterpriseEnabled(),
        secretsMode: scale.secretsMode,
        noProductionClaim: true as const,
      },
      ecosystem: {
        maturity: ecosystem.maturity,
        stagingApiSlo: {
          meetsTarget: stagingSlo.meetsTarget,
          availabilityPct: stagingSlo.availabilityPct,
          sampleCount: stagingSlo.sampleCount,
          latencyP95Ms: stagingSlo.latencyP95Ms,
        },
        totvsGoldenOk: ecosystem.totvsGoldenOk,
        noProductionClaim: true as const,
      },
      compliance: {
        maturity: compliance.maturity,
        packVersion: formatPackVersion(),
        packHashOk: compliance.packHashOk,
        dataMapEntries: compliance.dataMapEntries,
        anyForeignTaxEngine: false as const,
        noProductionClaim: true as const,
      },
      growth: {
        maturity: growth.maturity,
        guidedAssistEnabled: isGuidedAssistEnabled(),
        mobileReadOnly: true as const,
        noProductionClaim: true as const,
      },
      assurance: {
        maturity: assurance.maturity,
        readinessCompleteOrWaived: assurance.readinessCompleteOrWaived,
        sapGoldenOk: assurance.sapGoldenOk,
        soc2Certified: false as const,
        noProductionClaim: true as const,
      },
      capabilities: PLATFORM_OPS_CAPABILITIES,
      obligations: obligationRegistry,
      profiles: Object.fromEntries(
        Object.entries(OBLIGATION_SUPPORT_PROFILES).map(([k, v]) => [
          k,
          { maturity: v.maturity, officialProgram: v.officialProgram },
        ]),
      ),
      quota: { policy, usage },
      keyId: auth.keyId,
      requestId,
      time: new Date().toISOString(),
    },
    { headers: { "x-request-id": requestId } },
  );
}
