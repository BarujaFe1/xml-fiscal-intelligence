# Handoff — next AI wave (post Supabase unlock)

**Date:** 2026-07-11  
**Branch:** `feat/saas-enterprise-hardening`  
**Prod:** https://xml-fiscal-intelligence.vercel.app  
**Repo:** https://github.com/BarujaFe1/xml-fiscal-intelligence  

## Done in this wave (do not redo)

- Supabase project `uaqydwvdmwrwlvznoztd` (sa-east-1, org BarujaFe's 01)
- Schema + migrations `001`–`007` applied (RLS on all public tables; plan seeds; `handle_new_user` → profiles)
- `.env.local` has URL, anon, service role, DATABASE_URL, `FEATURE_CLOUD_PROCESSING=true`
- Service client: `src/lib/auth/supabase-service.ts`
- Migrate API persists batch metadata to `batches` (not full XML dump)
- Stripe **products/prices exist in test mode** — keys not wired (intentionally left for Stripe wave)
- Local `npm run dev` works with `.env.local`

## Explicitly OUT OF SCOPE for previous agent / YOUR next focus if asked

1. **Stripe live** — set `sk_test` / `pk_test` / `whsec`, webhook → `/api/billing/webhook`, `BILLING_PROVIDER=stripe`, `NEXT_PUBLIC_BILLING_READY=true`. Price IDs in `docs/BILLING_ARCHITECTURE.md`.
2. **Vercel env + redeploy** — mirror `.env.local` secrets (never commit). Auth redirect URLs already need both localhost + Vercel.
3. **Full document cloud sync** — migrate today stores batch registry only; XML stays IndexedDB.
4. **PVA desktop level-3** — human/desktop only.
5. **Push/PR/merge** — only with owner approval.

## Auth Dashboard checklist (human)

Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirects: `http://localhost:3000/auth/callback`, `https://xml-fiscal-intelligence.vercel.app/auth/callback`

## Verify quickly

```bash
npm run typecheck
npm run test
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

Expect: `supabase: true`, `cloudProcessing: true`, `billingLive: false`, `commercialReady: false` until Stripe.

## Honesty constraints (keep)

- EFD = assisted readiness, not PVA-official  
- Checkout redirect never grants plans  
- AI mock unless ENABLE_AI + consent + masking  
- No inventing tax rates / COD_VER without official registry
