# Security Test Plan

**Date:** 2026-07-11  
**Status:** Living checklist — automate where fixtures exist.

## Automated today

| Area | Suite |
| ---- | ----- |
| ZIP slip / dangerous ext | `tests/unit/zip.test.ts`, hardening-phase-b |
| Protocol / CNPJ / anomaly | `hardening-phase-b.test.ts` |
| Billing webhook idempotency + no redirect grant | `saas-sped.test.ts`, `hardening-phase-d.test.ts` |
| Permissions matrix (unit) | `saas-sped.test.ts` |
| Usage limit enforcement | `hardening-phase-d.test.ts` |
| PVA parser | `hardening-phase-d.test.ts` |

## Required before commercial launch

1. RLS cross-tenant matrix against live Supabase (two workspaces).  
2. Upload fixtures: XXE, zip bomb controlled, path traversal, nested zip.  
3. Checkout abandon + webhook replay + out-of-order events in Stripe test mode.  
4. Session expiry + IDOR on `/api/batches/[id]`.  
5. axe + keyboard on login/onboarding/dashboard.  
6. Secret scan CI + `npm audit` triage (no silent majors).

## Pass criteria (P0)

- Cross-tenant read denied by DB.  
- Malicious ZIP rejected without crash.  
- Entitlement not granted by `?session_id=`.  
- No service_role in client bundle.
