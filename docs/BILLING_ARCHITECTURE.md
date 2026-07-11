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

## Conta Stripe (MCP, test mode)

- Account: `acct_1Ts3NNK9MwFwrKTo` (“Área restrita de BarujaFe”)
- API keys: https://dashboard.stripe.com/acct_1Ts3NNK9MwFwrKTo/apikeys
- Webhook endpoint (criar no Dashboard → Developers → Webhooks):  
  `https://xml-fiscal-intelligence.vercel.app/api/billing/webhook`  
  Eventos mínimos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Products / Prices criados (livemode=false)

| Plano | Product | Price (mensal BRL) | Valor |
| ----- | ------- | ------------------ | ----- |
| Essencial | `prod_Urn0kns2xCyPpE` | `price_1Ts3QuK9MwFwrKToE5x2mOPt` | R$ 97,00 |
| Profissional | `prod_Urn1cwTzWaJGng` | `price_1Ts3QyK9MwFwrKTo9PYpcAGD` | R$ 297,00 |
| Escritório | `prod_Urn1WvqnmF5Fsx` | `price_1Ts3QzK9MwFwrKTovncqSWpH` | R$ 697,00 |

Metadata: `plan_id` = `essencial` | `profissional` | `escritorio`.  
Trial = `trial_period_days` no Checkout (sem product pago). Valores são placeholder de catálogo — ajuste no Dashboard se quiser outros preços.

### Env local (não commitar)

```
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_BILLING_READY=true
```
