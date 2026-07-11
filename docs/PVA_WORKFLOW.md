# PVA Workflow

**Date:** 2026-07-11

## Validation levels

| Level | Meaning | Who |
| ----- | ------- | --- |
| 1 | Structural internal (pipe layout, counters) | System |
| 2 | Relational/fiscal internal (readiness gaps) | System |
| 3 | Official PVA result | User records report from RFB PVA |

## Assisted registration

1. Generate TXT + manifesto in `/app/obligations/efd-icms-ipi`.  
2. Validate externally in the official PVA desktop app.  
3. Paste version + report lines (`ERRO:` / `AVISO:`) into the UI.  
4. `POST /api/obligations/efd-icms-ipi/pva` maps issues; does **not** run PVA.  
5. Persist to `pva_validation_runs` when Supabase is configured.

## Code

- `src/modules/obligations/efd-icms-ipi/pva/workflow.ts`  
- API route under `src/app/api/obligations/efd-icms-ipi/pva/`

## Honesty

Never mark generation as “PVA validated” without a level-3 record. Never automate captcha/PVA UI.
