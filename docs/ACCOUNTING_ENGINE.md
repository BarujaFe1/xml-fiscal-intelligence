# Accounting Engine

**Status:** Fase 4 — maturidade ECD `development`  
**UI:** `/app/ledger` · **Store:** IndexedDB `xfi_ledger_v1`  
**Migration:** `supabase/migrations/202607140005_accounting_ledger.sql`

## Princípios

- XML fiscal **não** gera lançamentos I200
- Partidas dobradas obrigatórias
- Contas sintéticas não recebem lançamento
- Contas DEMO bloqueiam modo oficial (`extras.ecdMode=ledger`)
- Modo DEMO só com `extras.ecdMode=demo`

## Módulos

| Path | Função |
|------|--------|
| `modules/accounting/types.ts` | ChartAccount / JournalEntry |
| `modules/accounting/rules.ts` | equilíbrio, vigência, imutabilidade |
| `modules/accounting/books.ts` | Diário, Razão, balancete, totais por natureza |
| `modules/accounting/import/csv.ts` | CSV/JSON genérico (ERP foundation) |
| `modules/accounting/import/ecd-prior.ts` | I050 de ECD anterior |
| `modules/obligations/ecd/from-ledger.ts` | TXT ECD a partir do ledger |

## Limitações

BP/DRE completos, conciliação bancária e Programa ECD homologado ficam para ciclos futuros.
