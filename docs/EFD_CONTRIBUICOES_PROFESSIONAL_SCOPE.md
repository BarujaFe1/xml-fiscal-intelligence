# EFD-Contribuições — Professional Scope

**Maturidade:** `internal_beta` (Fase 6)

Domínio próprio de apuração (receita, aquisição, crédito, débito, retenção, ajuste, CPRB) com persistência `xfi_contrib_v1`. XML NF-e permanece opcional para Bloco A — **não** gera Bloco M por soma silenciosa.

## Suportado

- Regimes versionados com `sourceId` (`non_cumulative` / `cumulative` / `cprb` / `mixed`)
- Bloco M a partir do domínio + rateio auditável (weights = 1)
- Modos dual: `current_fact_generation` | `historical_and_credit_management` (**nunca apagar**)
- NTs 11/2026 e 12/2026 em `rule_set_versions` (**activated=false**)
- Conciliação DCTFWeb/MIT via CSV import
- Simulador com/sem crédito atrás de `FEATURE_CONTRIB_SIMULATOR` (default off)
- Lab PGE: `homologationGrade` (hash + versão + status)

## Não suportado / limites

- Claim “substitui PGE”
- Crédito sem `creditExplicit`
- `validated_scope` / `production` sem evidência PGE por cenário
- Auto-ativar NTs sem fixture

Cockpit: `/app/contrib`. Docs: [`EFD_CONTRIBUICOES_LEDGER.md`](EFD_CONTRIBUICOES_LEDGER.md), [`PHASE_6_CONTRIBUICOES_PLAN.md`](PHASE_6_CONTRIBUICOES_PLAN.md).
