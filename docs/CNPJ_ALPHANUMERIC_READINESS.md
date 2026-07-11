# CNPJ Alphanumeric Readiness

**Date:** 2026-07-11  
**Branch:** `feat/saas-enterprise-hardening`  
**Official sources:**

- [Manual DV CNPJ](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf)
- [Perguntas CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf)
- IN RFB 2.229/2024 — production from July 2026

## Rules implemented

| Rule | Implementation |
| ---- | -------------- |
| Store as string | `normalizeCnpj` → uppercase 14 chars |
| Preserve letters | Never use `replace(/\D/g)` for CNPJ body |
| DV = ASCII−48 + mod 11 | `computeCnpjCheckDigits` |
| Mask formatting | `formatCnpj` / `formatCnpjCpf` |
| CPF unchanged | Still numeric 11 digits |

## Inventory of corrected call sites

| Location | Change |
| -------- | ------ |
| `src/lib/fiscal/cnpj.ts` | **New** central module |
| `src/lib/security/hash.ts` | Re-exports alphanumeric validators |
| `src/lib/utils/index.ts` | `formatCnpjCpf` alphanumeric-aware |
| `src/lib/quality/index.ts` | Uses `isValidCnpjOrCpf` |
| `src/lib/analytics/index.ts` | Search via `cnpjIncludes` |
| `src/app/.../parties/page.tsx` | Search via `cnpjIncludes` |
| `src/modules/obligations/efd-icms-ipi/plugin.ts` | `efdCnpj` for 0000 / participant codes |

## Remaining follow-ups

- DB columns must remain `text`/`varchar` (already planned in migrations).
- CSV/import masks that strip non-digits need audit in future import worker paths.
- Strict mode flag: `FEATURE_CNPJ_ALPHANUMERIC_STRICT` in `.env.example`.

## Tests

`tests/unit/hardening-phase-b.test.ts` — numeric valid/invalid, alphanumeric official example `12ABC34501DE35`, lowercase normalization, format.
