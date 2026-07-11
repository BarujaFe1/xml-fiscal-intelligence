# Implementation Status — SaaS Enterprise Hardening

**Branch:** `feat/saas-enterprise-hardening`  
**Started:** 2026-07-11  
**Last update:** 2026-07-11 (Phase B+C+import worker)

| Phase | Task | Status | Notes |
| ----- | ---- | ------ | ----- |
| A | Baseline + branch | `verified` | `IMPLEMENTATION_BASELINE.md` |
| B | Protocol extraction (`infProt/nProt`) | `tested` | Samples + namespace keys |
| B | Rename ICMS export | `tested` | `itens-cfop-ncm-sem-calculo-*.xlsx` |
| B | EFD/SPED honesty UI | `implemented` | Banner + nav “Diagnóstico EFD” |
| B | AI demo mode | `implemented` | Badge + block sensitive input |
| B | Billing demo mode | `implemented` | “Planos”; no fake subscription |
| B | Local persistence banner | `implemented` | App layout + upload/exports |
| B | Rule anomaly grouping | `tested` | `NO_PROTOCOL_ANOMALY` |
| C | CNPJ alphanumeric | `tested` | `src/lib/fiscal/cnpj.ts` + EFD 0150 |
| C | Auth/RLS deepen | `deferred_with_reason` | Schema+permissions ready; live RLS needs Supabase keys |
| D | IndexedDB→cloud migrate wizard | `deferred_with_reason` | Blocked without Supabase project |
| E | Import Web Worker + limits | `implemented` | Worker + fallback + cancel |
| E | Regulatory migrations | `implemented` | `202607110005_regulatory_governance.sql` |
| F | Landing honesty + onboarding checklist | `implemented` | PT-BR CTAs; no “SPED com um clique” |
| F–L | Later phases | `pending` | Cloud sync, Stripe live, E2E, admin/LGPD |

## Files (this wave)

- Parser protocol + RTC observe
- Import limits / zip-security / worker
- Honesty banners, nav PT-BR, billing/AI demo
- CNPJ module + docs
- Migration 005 regulatory tables

## Risks

- Cloud tenancy `blocked_external` without Supabase keys.
- Stripe checkout unavailable until `BILLING_PROVIDER=stripe` + keys.
- Web Worker may fall back to main thread if bundler rejects worker URL.

## External pendencies

1. Free Supabase project slot / `.env.local` keys  
2. Stripe test keys + webhook  
3. Manual PVA validation (desktop RFB)
