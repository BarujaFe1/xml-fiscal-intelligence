import { NextResponse } from "next/server";
import { billingIsLive, getBillingProvider } from "@/lib/billing/provider";

/**
 * Create Checkout session. Never unlocks entitlements by itself —
 * subscription becomes active only after verified webhook.
 */
export async function POST(req: Request) {
  if (!billingIsLive()) {
    return NextResponse.json(
      {
        error: "Checkout indisponível. Stripe não está configurado neste ambiente.",
        code: "billing_unavailable",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as {
      workspaceId?: string;
      customerEmail?: string;
      priceId?: string;
      successUrl?: string;
      cancelUrl?: string;
      trialDays?: number;
    };

    if (!body.workspaceId || !body.customerEmail || !body.priceId) {
      return NextResponse.json(
        { error: "workspaceId, customerEmail e priceId são obrigatórios" },
        { status: 400 },
      );
    }

    const origin = new URL(req.url).origin;
    const provider = getBillingProvider();
    const session = await provider.createCheckoutSession({
      workspaceId: body.workspaceId,
      customerEmail: body.customerEmail,
      priceId: body.priceId,
      successUrl: body.successUrl || `${origin}/app/billing?checkout=success`,
      cancelUrl: body.cancelUrl || `${origin}/app/billing?checkout=cancel`,
      trialDays: body.trialDays,
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.sessionId,
      note: "Assinatura só é liberada após webhook assinado — ignore o redirect como fonte de verdade.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "checkout failed" },
      { status: 500 },
    );
  }
}
