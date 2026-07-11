import { NextResponse } from "next/server";
import { getBillingProvider, billingIsLive } from "@/lib/billing/provider";

/** Read subscription snapshot — never trust query-string plan grants. */
export async function GET(req: Request) {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const provider = getBillingProvider();
  const snap = await provider.getSubscriptionStatus(workspaceId);
  return NextResponse.json({
    ...snap,
    billingLive: billingIsLive(),
  });
}
