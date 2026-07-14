# Motor ECF (Fase 5)

**Status:** `development`  
**Branch:** `feat/ecf-from-ecd`

## Componentes

| Área | Path |
|------|------|
| Tipos | `src/modules/ecf/types.ts` |
| Mapper | `src/modules/ecf/mapper.ts` |
| Recovery ECD/ECF | `src/modules/ecf/recovery/*` |
| e-Lalur | `src/modules/ecf/elalur/model.ts` |
| Referenciais | `src/modules/ecf/referential/catalog.ts` |
| IRPJ gated | `src/modules/ecf/irpj/engine.ts` |
| Conciliação | `src/modules/ecf/reconcile.ts` |
| Plugin | `src/modules/obligations/ecf/plugin.ts` |
| Build | `src/modules/obligations/ecf/from-workspace.ts` |
| IDB | `src/lib/store/ecf.ts` (`xfi_ecf_v1`) |
| UI | `/app/ecf` |

## Extras do plugin

- `ecfMode`: `demo` \| `official` \| `auto`
- `ecdLedger` / `ledger`: snapshot contábil
- `accountMaps`, `elalur`, `referentialTables`, `priorEcf`
- `FEATURE_ECF_IRPJ_ENGINE` (default off)

## Regras

- Sem IRPJ de XML fiscal
- DEMO no ledger bloqueia oficial
- Órfãs no mapper bloqueiam oficial
- Sugestões de prior nunca auto-aplicam
