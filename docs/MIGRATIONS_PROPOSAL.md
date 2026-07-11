# Proposed Migrations — SaaS SPED Platform

> Phase 0 proposal only. **Do not apply to production automatically.**  
> Target location: `supabase/migrations/` (to be created in Phase 1).  
> Builds on `supabase/schema.sql` + `supabase/schema-enterprise.sql`.

## Principles

- Idempotent where possible (`if not exists`)  
- Expand roles carefully (migrate `member` → `operator` or keep + add)  
- Every tenant table: `workspace_id`, RLS, indexes  
- Money: `numeric(18,2)` or `numeric(18,6)` — never float in DB  
- No secrets / certificates in tables (metadata only)

---

## Pack 001 — Identity & tenancy

- Harden `profiles` (RLS, trigger on `auth.users`)
- `workspaces` insert/update policies for creators
- `workspace_members` policies + expanded role check constraint
- `workspace_invites` (email, role, token hash, expires_at, accepted_at)
- Optional `organizations` (accounting office) linking many workspaces later

## Pack 002 — Companies & establishments

- Evolve `companies` (legal entity)
- `establishments` (CNPJ branch, IE, UF, COD_MUN, address, IND_PERFIL, IND_ATIV)
- `tax_profiles` / `fiscal_settings` (period defaults, layout preferences)
- `accountants`, `company_accountants`
- `company_certificates_metadata` (filename, validity, **no PFX bytes**)

## Pack 003 — Billing & entitlements

- `billing_customers`, `billing_products`, `billing_prices`
- `subscriptions`, `subscription_items`
- `billing_events` (idempotency key unique)
- `billing_invoices` (provider references)
- `plan_versions`, `plan_entitlements`, `entitlements`
- `usage_counters`, `usage_events`
- Seed plans without hard-coded BRL amounts in application code (prices in Stripe + DB)

## Pack 004 — Imports & jobs

- Align `import_batches` with runtime
- `import_files`, `import_jobs` (status, attempts, locked_at, heartbeat, idempotency_key, dlq)
- `import_logs`, `import_errors`
- Storage path columns; signed URL flow documented in STORAGE_AND_JOBS.md (Phase 3)

## Pack 005 — Documents v2

- Promote tax columns on items: cst, csosn, cest, v_bc_icms, aliq_icms, v_icms, …  
- `participants`, `products`, `product_units`, `product_conversions`
- `fiscal_document_events`, `fiscal_document_references`
- Keep `raw` XML in private storage; DB holds path + hash

## Pack 006 — Fiscal rules registry

- `official_sources`
- `rule_sets`, `rule_set_versions`
- `record_definitions`, `field_definitions`
- `validation_rules`, `conditional_rules`
- `official_tables`, `official_table_versions`, `official_table_entries`
- `state_rules`

## Pack 007 — Obligation generations

- `obligation_generations`, `obligation_generation_versions`
- `obligation_records`, `obligation_record_fields`
- `generation_lineage`, `generation_validations`, `generation_issues`
- `generation_overrides` (justification required)
- `generation_files`, `generation_manifests`
- `pva_validation_runs`, `pva_validation_issues`
- `transmission_receipts` (import only in early phases)

## Pack 008 — Security & audit

- `audit_logs`, `security_events`, `admin_actions`
- `data_access_logs`, `support_access_requests`
- Retention helpers / soft-delete columns as needed

---

## Compatibility with existing schemas

| Existing | Action |
|----------|--------|
| `batches` / `documents` | Keep for transition; map → `import_batches` / `fiscal_documents` or rename carefully |
| `workspace_members` roles | Expand CHECK; migrate data |
| Enterprise tables without RLS | Add policies in same pack as table touch |
| IndexedDB | Remains client cache / privacy mode — not a migration |

---

## Rollback stance

- Prefer expand-only migrations  
- Destructive drops require explicit owner approval + backup  
- CI: `migration check` dry-run against ephemeral DB (Phase 1+)
