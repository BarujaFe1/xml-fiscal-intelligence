# Billing Architecture

**Date:** 2026-07-11

## Provider interface

`BillingProvider` in `src/lib/billing/provider.ts`:

- `createCheckoutSession`  
- `createCustomerPortalSession`  
- `cancelSubscription` / `resumeSubscription` / `changePlan`  
- `processWebhook` (signature + idempotency)  
- `getSubscriptionStatus`

## Live gate

Stripe is live only when **all** are true:

- `BILLING_PROVIDER=stripe`  
- `STRIPE_SECRET_KEY` set  
- `NEXT_PUBLIC_BILLING_READY=true`

Otherwise UI shows **Planos** demonstration; checkout API returns **503**.

## Critical rule

Checkout redirect **never** grants entitlements. Only verified webhook (or trusted server reconciliation) activates plans.

## Usage

`src/lib/entitlements/usage.ts` provides process-local counters with per-key serialization. Replace with Postgres when multi-instance.

## Routes

- `POST /api/billing/checkout`  
- `GET /api/billing/subscription?workspaceId=`  
- `POST /api/billing/webhook`
