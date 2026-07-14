# Fiscal Closing Cockpit

UI: `/app/closing` · store: `src/lib/store/closing-cockpit.ts` · domain: `core/workflows/closing.ts`

## Modelo

Empresa → Estabelecimento → Competência (`YYYY-MM` ou `YYYY`) → células por obrigação.

Status de célula: `ClosingCellStatus` (não iniciada … recibo / retificação).

## Fase 1

- CRUD local IndexedDB
- Checklist padrão por célula
- Link para assistente
- API `/api/closing` reconhece snapshot (persistência cloud diferida)

## Não incluso

- SLA automático
- Notificações
- Fechamento em massa multi-workspace
- Datas de vencimento (ver `FISCAL_CALENDAR.md`)
