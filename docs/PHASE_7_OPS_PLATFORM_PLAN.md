# Plano detalhado — Fase 7: Plataforma operacional (trilhas transversais)

**Status pós-implementação:** feito em `feat/ops-platform-phase7` — maturidade plataforma `internal_beta`.  
**Sem** push/deploy sem autorização.  
**Próximo:** [`PHASE_8_RTC_PLAN.md`](PHASE_8_RTC_PLAN.md).

## Checklist

- [x] Calendário descritivo com `sourceId` + iCal lembrete (não vencimento legal)
- [x] Tarefas + SoD preparador ≠ aprovador + audit
- [x] Gerações imutáveis + retificação/diff
- [x] Cofre evidências (metadata) + API
- [x] Notificações sanitizadas + rate limit
- [x] `/api/v1` OpenAPI + status + obligations + evidence + commercial-matrix
- [x] ERP CSV/JSON genérico (preview/idempotência)
- [x] Catálogo regulatório identified→published (sem auto-ativar)
- [x] Matriz comercial espelhando maturidade real
- [x] Telemetria mínima + testes + migration
- [x] UI `/app/ops` · docs · plano Fase 8

## Critérios de saída

- [x] Closing consome link/calendário sem datas inventadas
- [x] Evidências ligadas a `contentHash` / generationId
- [x] OpenAPI local; API key smoke (local-dev)
- [x] Matriz sem célula production claim
- [x] Nenhuma obrigação elevada só pela Fase 7

## Kickoff original

**“aplique Fase 7”** — concluído.
