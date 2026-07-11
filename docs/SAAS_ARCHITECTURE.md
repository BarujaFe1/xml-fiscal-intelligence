# SAAS Architecture (implemented skeleton)

See also `docs/SAAS_SPED_MASTER_PLAN.md` and `docs/CURRENT_STATE_AUDIT.md`.

## Runtime modes

1. **Privacy / demo** — no Supabase keys: IndexedDB + local EFD generate API.  
2. **SaaS** — Supabase Auth + RLS migrations + entitlements + optional Stripe.

## Key modules

- `src/lib/auth` — SSR/browser clients, permissions, middleware session  
- `src/lib/billing` — BillingProvider (mock/stripe stub)  
- `src/lib/entitlements` — plan seeds + limit checks  
- `src/lib/jobs` — queue contract  
- `src/lib/storage` — private local storage  
- `src/lib/money` — fixed-scale decimal  
- `src/modules/obligations` — plugin core + EFD ICMS/IPI  

## Migrations

`supabase/migrations/202607110001_*.sql` … `003_*.sql`
