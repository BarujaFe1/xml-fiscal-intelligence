# EFD-Contribuições — Domínio de apuração (Fase 6)

**Status:** `internal_beta`  
**Branch:** `feat/efd-contribuicoes-ledger`  
**IDB:** `xfi_contrib_v1` · Migration: `202607140007_efd_contribuicoes_ledger.sql`

## Entidades

| Kind | Uso |
|------|-----|
| revenue | Receitas (base informada; sem alíquota inventada) |
| acquisition | Aquisições |
| credit | Crédito — **exige** `creditExplicit=true` |
| debit | Débito / contribuição lançada |
| retention | Retenções |
| adjustment | Ajustes (NT 12: sem inventar redução) |
| cprb | CPRB |

## Fluxo

1. Lançar domínio em `/app/contrib` ou `extras.contribSnapshot`
2. Tipificar regime → 0110
3. XML opcional → A100/A170
4. `buildBlocoMDrafts` → M100/M200/… com lineage
5. Conciliação DCTF/MIT; simulador lab; hash PGE

## Modos dual

Ambos permanecem após NT 11/2026. Histórico não é apagado.
