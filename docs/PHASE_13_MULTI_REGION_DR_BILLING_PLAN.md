# Plano detalhado — Fase 13: Multi-região · DR · billing · campanhas massivas

**Status pós-implementação:** feito em `feat/multi-region-dr-billing` — plataforma `internal_beta`.  
**Sem** selo SOC2. **Sem** production global.  
**Próximo:** [`PHASE_14_SLO_PARTNERS_ERP_PLAN.md`](PHASE_14_SLO_PARTNERS_ERP_PLAN.md).

## Checklist

- [x] Inventário persistência + RPO/RTO + procedure + drill staging
- [x] Health regional em `/api/v1/status`
- [x] Planos free→enterprise + metering + quotas continuous-ops
- [x] FEATURE billing gate honesto
- [x] Campanhas massivas multi-UF + cobertura + §28 agregado
- [x] Secrets mode + pen-test triage + residual risks
- [x] UI `/app/scale` · tests · migration · plano Fase 14

## Critérios de saída

- [x] DR runbook + drill documentado
- [x] Billing metering funcional (local/staging)
- [x] Campanhas sem promote global
- [x] Zero `production` global

## Kickoff original

**“aplique Fase 13”** — concluído.
