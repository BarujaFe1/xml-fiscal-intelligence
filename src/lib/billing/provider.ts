/**
 * Billing provider abstraction.
 * Production adapter: Stripe (REST + webhook HMAC). Mercado Pago reserved.
 * Never grant paid access from checkout redirect alone — only webhook (or verified server state).
 */

import { createHmac, timingSafeEqual } from "crypto";

export type CheckoutResult = { url: string; sessionId: string };
export type PortalResult = { url: string };
export type SubscriptionSnapshot = {
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "none";
  planId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  provider: "mock" | "stripe";
};

export type BillingEventResult = {
  handled: boolean;
  eventId: string;
  type: string;
  duplicate?: boolean;
  workspaceId?: string;
  planId?: string | null;
};

export interface BillingProvider {
  createCheckoutSession(input: {
    workspaceId: string;
    customerEmail: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
  }): Promise<CheckoutResult>;
  createCustomerPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<PortalResult>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  resumeSubscription(subscriptionId: string): Promise<void>;
  changePlan(input: { subscriptionId: string; newPriceId: string }): Promise<void>;
  processWebhook(input: {
    rawBody: string;
    signature: string;
  }): Promise<BillingEventResult>;
  getSubscriptionStatus(workspaceId: string): Promise<SubscriptionSnapshot>;
}

function isBillingReady(): boolean {
  return (
    process.env.BILLING_PROVIDER === "stripe" &&
    Boolean(process.env.STRIPE_SECRET_KEY) &&
    process.env.NEXT_PUBLIC_BILLING_READY === "true"
  );
}

/** In-memory mock — checkout does NOT activate plans; only signed webhook does. */
export class MockBillingProvider implements BillingProvider {
  private events = new Set<string>();
  private subs = new Map<string, SubscriptionSnapshot>();
  private pendingSessions = new Map<string, { workspaceId: string; priceId: string }>();

  async createCheckoutSession(input: {
    workspaceId: string;
    customerEmail: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
  }): Promise<CheckoutResult> {
    const sessionId = `mock_cs_${input.workspaceId}_${Date.now()}`;
    this.pendingSessions.set(sessionId, {
      workspaceId: input.workspaceId,
      priceId: input.priceId,
    });
    // Intentionally do NOT mutate subs here — redirect alone must not unlock paid features.
    void input.customerEmail;
    void input.cancelUrl;
    void input.trialDays;
    return { url: `${input.successUrl}?session_id=${sessionId}&pending=1`, sessionId };
  }

  async createCustomerPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<PortalResult> {
    return { url: `${input.returnUrl}?portal=mock&customer=${input.customerId}` };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    for (const [ws, snap] of this.subs) {
      if (subscriptionId.includes(ws)) {
        this.subs.set(ws, { ...snap, status: "canceled", cancelAtPeriodEnd: false });
      }
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    void subscriptionId;
  }

  async changePlan(): Promise<void> {}

  async processWebhook(input: {
    rawBody: string;
    signature: string;
  }): Promise<BillingEventResult> {
    if (input.signature !== "mock_valid") {
      throw new Error("Invalid webhook signature");
    }
    const parsed = JSON.parse(input.rawBody) as {
      id: string;
      type: string;
      workspaceId?: string;
      planId?: string;
      sessionId?: string;
    };
    if (this.events.has(parsed.id)) {
      return { handled: true, eventId: parsed.id, type: parsed.type, duplicate: true };
    }
    this.events.add(parsed.id);

    let workspaceId = parsed.workspaceId;
    if (!workspaceId && parsed.sessionId) {
      workspaceId = this.pendingSessions.get(parsed.sessionId)?.workspaceId;
    }

    if (
      workspaceId &&
      (parsed.type === "checkout.session.completed" ||
        parsed.type === "customer.subscription.updated" ||
        parsed.type === "invoice.paid")
    ) {
      this.subs.set(workspaceId, {
        status: "active",
        planId: parsed.planId || "essencial",
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        cancelAtPeriodEnd: false,
        provider: "mock",
      });
    }

    return {
      handled: true,
      eventId: parsed.id,
      type: parsed.type,
      workspaceId,
      planId: parsed.planId || null,
    };
  }

  async getSubscriptionStatus(workspaceId: string): Promise<SubscriptionSnapshot> {
    return (
      this.subs.get(workspaceId) || {
        status: "none",
        planId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        provider: "mock",
      }
    );
  }
}

function verifyStripeSignature(rawBody: string, header: string, secret: string): boolean {
  // Stripe-Signature: t=timestamp,v1=hex
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as Record<string, string>;
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export class StripeBillingProvider implements BillingProvider {
  private events = new Set<string>();
  private subs = new Map<string, SubscriptionSnapshot>();

  constructor(
    private secretKey: string,
    private webhookSecret?: string,
  ) {
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY required");
  }

  private async stripeForm(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const body = new URLSearchParams(params);
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = json.error as { message?: string } | undefined;
      throw new Error(err?.message || `Stripe API ${res.status}`);
    }
    return json;
  }

  async createCheckoutSession(input: {
    workspaceId: string;
    customerEmail: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
  }): Promise<CheckoutResult> {
    if (!isBillingReady()) {
      throw new Error("Billing Stripe não está pronto (NEXT_PUBLIC_BILLING_READY / chaves).");
    }
    const params: Record<string, string> = {
      mode: "subscription",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": "1",
      customer_email: input.customerEmail,
      "metadata[workspace_id]": input.workspaceId,
      client_reference_id: input.workspaceId,
    };
    if (input.trialDays && input.trialDays > 0) {
      params["subscription_data[trial_period_days]"] = String(input.trialDays);
    }
    const session = await this.stripeForm("checkout/sessions", params);
    const url = String(session.url || "");
    const sessionId = String(session.id || "");
    if (!url || !sessionId) throw new Error("Stripe Checkout sem URL");
    return { url, sessionId };
  }

  async createCustomerPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<PortalResult> {
    if (!isBillingReady()) {
      throw new Error("Billing Stripe não está pronto.");
    }
    const session = await this.stripeForm("billing_portal/sessions", {
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: String(session.url || "") };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.stripeForm(`subscriptions/${subscriptionId}`, {
      cancel_at_period_end: "true",
    });
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.stripeForm(`subscriptions/${subscriptionId}`, {
      cancel_at_period_end: "false",
    });
  }

  async changePlan(input: { subscriptionId: string; newPriceId: string }): Promise<void> {
    // Minimal path: caller should pass item id in production; here we document need for item lookup.
    void input;
    throw new Error(
      "changePlan exige subscription item id — use o Customer Portal ou implemente listagem de items.",
    );
  }

  async processWebhook(input: {
    rawBody: string;
    signature: string;
  }): Promise<BillingEventResult> {
    const secret = this.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "";
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET required");
    if (!verifyStripeSignature(input.rawBody, input.signature, secret)) {
      throw new Error("Invalid Stripe webhook signature");
    }
    const event = JSON.parse(input.rawBody) as {
      id: string;
      type: string;
      data?: { object?: Record<string, unknown> };
    };
    if (this.events.has(event.id)) {
      return { handled: true, eventId: event.id, type: event.type, duplicate: true };
    }
    this.events.add(event.id);

    const obj = event.data?.object || {};
    const meta = (obj.metadata || {}) as Record<string, string>;
    const workspaceId =
      meta.workspace_id ||
      (typeof obj.client_reference_id === "string" ? obj.client_reference_id : undefined);

    if (
      workspaceId &&
      (event.type === "checkout.session.completed" ||
        event.type === "customer.subscription.updated" ||
        event.type === "invoice.paid")
    ) {
      const statusRaw = String(obj.status || "active");
      const status: SubscriptionSnapshot["status"] =
        statusRaw === "trialing"
          ? "trialing"
          : statusRaw === "past_due"
            ? "past_due"
            : statusRaw === "canceled"
              ? "canceled"
              : "active";
      this.subs.set(workspaceId, {
        status,
        planId: meta.plan_id || null,
        currentPeriodEnd: obj.current_period_end
          ? new Date(Number(obj.current_period_end) * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        provider: "stripe",
      });
    }

    return {
      handled: true,
      eventId: event.id,
      type: event.type,
      workspaceId,
      planId: meta.plan_id || null,
    };
  }

  async getSubscriptionStatus(workspaceId: string): Promise<SubscriptionSnapshot> {
    return (
      this.subs.get(workspaceId) || {
        status: "none",
        planId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        provider: "stripe",
      }
    );
  }
}

export function getBillingProvider(): BillingProvider {
  const provider = process.env.BILLING_PROVIDER || "mock";
  if (provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
    return new StripeBillingProvider(
      process.env.STRIPE_SECRET_KEY,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  }
  return new MockBillingProvider();
}

export function billingIsLive(): boolean {
  return isBillingReady();
}
