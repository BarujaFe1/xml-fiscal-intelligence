# Fiscal Rules & Audit

## CFOP

Local table in `src/lib/fiscal/cfop.ts` — subset of common codes. Expand via seed/CSV later.

## Audit engine

`src/modules/audit/fiscal-audit-engine.ts` emits findings such as:

- `DUP_ACCESS_KEY`, `DUP_XML_HASH`
- `NO_ACCESS_KEY`, `NO_PROTOCOL`
- `INVALID_EMITTER_DOC`, `INVALID_RECEIVER_DOC`
- `ZERO_TOTAL`, `ITEM_SUM_DIVERGENCE`
- `ITEM_NO_NCM`, `ITEM_NO_CFOP`, `ITEM_NO_DESCRIPTION`
- `CTE_NO_NFE_LINK`, `OUTSIDE_PERIOD`, `PARSE_ERROR`

Each finding: severity, category, code, title, description, evidence, recommendation, status.

## Custom rules (planned)

No-code rule builder is Priority 3 — schema ready in `custom_rules` (`schema-enterprise.sql`).
