# Changelog

## Unreleased — `feat/saas-enterprise-hardening`

### Fixed
- Authorization protocol extraction via `infProt/nProt` (namespaces, incomplete prot, anomaly collapse).
- Misleading “Apuração ICMS” export renamed to itens CFOP/NCM without tax calculation.
- EFD participant CNPJ fields preserve alphanumeric digits/letters.

### Added
- Implementation baseline + live status diary.
- CNPJ alphanumeric module + readiness doc.
- RTC observation helper (no invented rates).
- Import `IMPORT_LIMITS`, Zip Slip controls, Web Worker pipeline with cancel/fallback.
- Regulatory governance migration (`official_source_versions`, rule sets, schema catalog).
- Honesty banners (local persistence, EFD diagnostic).
- Feature flags and billing/AI demonstration states.
- Landing honesty messaging + dashboard onboarding checklist.
- IndexedDB → cloud migrate wizard (`/app/migrate`) with safe 503.
- PVA level-3 registration API + UI.
- Usage counters + billing checkout/subscription routes.
- LGPD / retention / incident / backup / PVA / billing docs.
- Password recovery + `/auth/callback`.
- Fiscal context selector (URL + preference).
- Audit rule catalog + grouped triage workflow.
- `/api/health` + `/api/ready` + observability facade.
- CSV/XLSX formula injection sanitization.

### Security / honesty
- Demo billing does not grant paid plans via redirect.
- Demo AI blocks sensitive prompts and labels simulated answers.
- SPED UI titled as readiness diagnostic with persistent PVA disclaimer.
