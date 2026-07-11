# Implementation Baseline — SaaS Enterprise Hardening

**Date:** 2026-07-11  
**Branch:** `feat/saas-enterprise-hardening`  
**Initial commit:** `fec8a9d71d95ab96cac2a63ce8f516313af111f3` (master tip at branch creation)

## Runtime

| Item | Value |
| ---- | ----- |
| Node | v22.14.0 |
| npm | 10.9.2 |
| Next.js | 16.2.10 |
| React | 19.2.4 |
| TypeScript | ^5 |
| Vitest | ^4.1.10 |
| Playwright | ^1.61.1 |
| @supabase/ssr | ^0.12.0 |
| Stripe | not installed as SDK yet (mock/stub provider) |

## Baseline commands (pre-change)

| Command | Result |
| ------- | ------ |
| `npm install` | OK (649 packages; 4 moderate advisories) |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS — 6 files, **38** tests |
| `npm run build` | PASS (Turbopack NFT warning on `storage/provider` via generate route) |

## Existing routes (app)

Marketing: `/`  
Auth: `/login`, `/signup`  
App: `/app`, `/upload`, `/batches`, `/search`, `/audit`, `/relationships`, `/obligations`, `/obligations/efd-icms-ipi`, `/sped`, `/ai`, `/billing`, `/settings`  
Batch detail tabs under `/app/batches/[id]/*`  
API: batches CRUD/import/export, billing webhook, EFD generate, search

## Existing modules (high level)

- Parser NF-e / CT-e / NFS-e + flatten + quality score
- IndexedDB batch store (primary persistence on Vercel without Supabase)
- Audit engine, relationships, SPED preview tree (diagnostic)
- EFD ICMS/IPI plugin (readiness + partial builders + serialize + manifest)
- Billing provider abstraction (mock default)
- AI mock chat
- Auth scaffolding with `@supabase/ssr` (keys often empty)

## Database

Migrations present:

- `202607110001_saas_foundation.sql`
- `202607110002_billing_entitlements.sql`
- `202607110003_jobs_obligations.sql`
- `202607110004_official_sources_seed.sql`

Plus `supabase/schema.sql`, `schema-enterprise.sql`.  
**External:** Supabase free-tier project slot was previously blocked; cloud multi-tenancy not live until keys configured.

## Environment variables (from `.env.example`)

Supabase URL/anon/service/DATABASE_URL; BILLING_PROVIDER; Stripe keys; storage; upload limits; demo/privacy flags; ENABLE_AI; XSD/signature; DuckDB; Vercel project name.

## Functional honesty inventory (baseline)

| Area | Status |
| ---- | ------ |
| ZIP import + parse (local IndexedDB) | **Real** |
| Quality / search / Excel export | **Real** |
| Audit findings | **Real** (heuristic) |
| EFD generate API (partial records) | **Real but incomplete** — not PVA-validated |
| SPED preview | **Diagnostic** |
| AI chat | **Mock** (`ENABLE_AI=false`) |
| Billing UI | **Demo** (`BILLING_PROVIDER=mock`) — exposes technical entitlement keys |
| Cloud multi-tenant RLS live | **Stub/schema ready** — blocked without Supabase |
| Protocol extraction | **Bug** — sample NF-e with `protNFe/infProt/nProt` not extracted when `protNFe` wins `findNode` |
| Export “Apuração ICMS” | **Misleading label** — items by CFOP/NCM only |
| IndexedDB | Presented as app data — cloud sync not primary |

## Known pre-existing limitations (do not attribute to this branch)

- Middleware deprecation notice (Next prefers `proxy`)
- NFT warning from dynamic storage path
- EFD COD_VER / Bloco E/H/K/G incomplete
- No automatic SPED transmission
- Stripe Checkout not wired end-to-end
