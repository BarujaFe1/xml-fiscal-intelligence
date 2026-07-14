# Plano detalhado — Fase 6: EFD-Contribuições (histórica + 2026 + pós-2027)

**Status pós-implementação:** feito em `feat/efd-contribuicoes-ledger` — maturidade `internal_beta`.  
**Branch:** `feat/efd-contribuicoes-ledger`  
**Sem** push/deploy sem autorização.  
**Próximo:** [`PHASE_7_OPS_PLATFORM_PLAN.md`](PHASE_7_OPS_PLATFORM_PLAN.md).

## Objetivo

Evoluir EFD-Contribuições de rascunho XML-cêntrico para **domínio próprio de apuração**, regimes versionados, livros auxiliares, Bloco M auditável, modos dual até 2027+, NTs 11/2026 e 12/2026 em `rule_set_versions`, conciliação DCTFWeb/MIT + lab PGE, simulador gated.

## Maturidade

| Marco | Status |
|-------|--------|
| Domínio + readiness + livros | ✓ |
| Bloco M + rateio + golden parcial | ✓ → `internal_beta` |
| Cenário PGE aceito | pendente lab |
| `validated_scope` / `production` | não |

## Checklist

### 6.1–6.7

- [x] Entidades domínio + vínculos opcionais auditados
- [x] IDB `xfi_contrib_v1` + migration
- [x] Doc `EFD_CONTRIBUICOES_LEDGER.md`
- [x] Regimes versionados + readiness
- [x] Scope + matriz maturidade
- [x] Livros + Bloco M + rateio + golden unit
- [x] Modos dual documentados
- [x] NTs 11/12 catalogadas (`activated=false`)
- [x] Conciliação DCTF/MIT + `homologationGrade` PGE
- [x] Simulador `FEATURE_CONTRIB_SIMULATOR` default off
- [x] UI `/app/contrib`
- [x] Plano Fase 7

## Critérios de saída

- [x] Matriz regime/período (perfis + docs)
- [x] Golden parcial Bloco M verde
- [x] Dual modes documentados
- [x] Sem célula `production`

## Kickoff original

**“aplique Fase 6”** — concluído.
