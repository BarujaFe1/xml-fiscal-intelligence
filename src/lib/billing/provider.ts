/**
 * Billing provider abstraction.
 * Production adapter: Stripe. Mercado Pago reserved — not exposed in UI until complete.
 */

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

/** In-memory mock for local/dev without Stripe keys. Never grants access from browser redirects alone. */
export class MockBillingProvider implements BillingProvider {
  private events = new Set<string>();
  private subs = new Map<string, SubscriptionSnapshot>();

  async createCheckoutSession(input: {
    workspaceId: string;
    customerEmail: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
  }): Promise<CheckoutResult> {
    const sessionId = `mock_cs_${input.workspaceId}`;
    this.subs.set(input.workspaceId, {
      status: "trialing",
      planId: "trial",
      currentPeriodEnd: new Date(Date.now() + 14 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      provider: "mock",
    });
    return { url: `${input.successUrl}?session_id=${sessionId}`, sessionId };
  }

  async createCustomerPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<PortalResult> {
    return { url: `${input.returnUrl}?portal=mock&customer=${input.customerId}` };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    void subscriptionId;
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
    const parsed = JSON.parse(input.rawBody) as { id: string; type: string };
    if (this.events.has(parsed.id)) {
      return { handled: true, eventId: parsed.id, type: parsed.type, duplicate: true };
    }
    this.events.add(parsed.id);
    return { handled: true, eventId: parsed.id, type: parsed.type };
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

export class StripeBillingProvider implements BillingProvider {
  constructor(private secretKey: string) {
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY required");
  }

  async createCheckoutSession(): Promise<CheckoutResult> {
    throw new Error(
      "Stripe Checkout not fully wired — configure STRIPE_* keys and implement session create via Stripe SDK in a follow-up deploy.",
    );
  }
  async createCustomerPortalSession(): Promise<PortalResult> {
    throw new Error("Stripe portal not fully wired");
  }
  async cancelSubscription(): Promise<void> {
    throw new Error("Stripe cancel not fully wired");
  }
  async resumeSubscription(): Promise<void> {
    throw new Error("Stripe resume not fully wired");
  }
  async changePlan(): Promise<void> {
    throw new Error("Stripe changePlan not fully wired");
  }
  async processWebhook(): Promise<BillingEventResult> {
    throw new Error("Stripe webhook handler requires stripe SDK wiring");
  }
  async getSubscriptionStatus(): Promise<SubscriptionSnapshot> {
    return {
      status: "none",
      planId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      provider: "stripe",
    };
  }
}

export function getBillingProvider(): BillingProvider {
  const provider = process.env.BILLING_PROVIDER || "mock";
  if (provider === "stripe" && process.env.STRIPE_SECRET_KEY) {
    return new StripeBillingProvider(process.env.STRIPE_SECRET_KEY);
  }
  return new MockBillingProvider();
}
