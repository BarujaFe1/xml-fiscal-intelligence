import { NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/billing/provider";

/** Stripe/mock webhooks — signature required; idempotent. */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || req.headers.get("x-billing-signature") || "";
  try {
    const provider = getBillingProvider();
    const result = await provider.processWebhook({ rawBody, signature });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "webhook failed" },
      { status: 400 },
    );
  }
}
