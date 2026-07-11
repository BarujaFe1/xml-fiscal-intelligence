# LGPD — Data Map (template subject to legal review)

**Status:** Engineering draft — **not** a final legal opinion.  
**Date:** 2026-07-11

## Categories of personal / fiscal data

| Category | Examples | Storage today | Purpose |
| -------- | -------- | ------------- | ------- |
| Account | e-mail, user id | Supabase Auth (when configured) | Access control |
| Workspace membership | role, invite e-mail | Postgres (schema ready) | Multi-tenant access |
| Company / establishment | CNPJ, IE, address | Postgres / local form | Obligation context |
| Fiscal documents | access key, parties, items, values | IndexedDB local; cloud planned | Analysis / EFD prep |
| Raw XML | full document | Local / private storage path | Reprocess / audit |
| Audit findings | rule hits, comments | Local / Postgres planned | Review workflow |
| Billing | customer id, invoices | Stripe (when live) | Subscription |
| Support diagnostics | correlation id, safe codes | Logs (no raw XML) | Incident response |
| PVA reports | user-pasted text | localStorage / DB planned | Level-3 validation record |

## Legal bases (draft — lawyer must confirm)

- Contract / legitimate interest for SaaS processing of fiscal XML uploaded by the controller (client).
- Consent for optional AI features that send masked excerpts.
- Legal obligation where applicable to retention of fiscal books (client remains controller of SPED filings).

## Sub-processors (planned)

| Processor | Role | Data |
| --------- | ---- | ---- |
| Vercel | Hosting | Request metadata |
| Supabase | Auth + DB + storage | Account + tenant data |
| Stripe | Payments | Billing identity |
| AI provider (optional) | Explanations | Masked excerpts only if ENABLE_AI |

## Data subject rights (product hooks)

- Access / export: batch JSON/CSV exports + future account export API.
- Deletion: workspace deletion request (see RETENTION_POLICY.md) — not fully automated yet.
- Correction: cadastro company/establishment screens (SaaS).

## Notes

Templates here must be reviewed by counsel before commercial privacy policy publication.
