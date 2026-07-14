# Fiscal Calendar

**Status:** Fase 7 — catálogo descritivo operacional  
**Código:** [`src/modules/ops/calendar.ts`](../src/modules/ops/calendar.ts)

## Regras

- Toda regra exige `sourceId` oficial
- **Proibido** inventar dia do vencimento (ex.: “dia 15”) no produto
- `dueRule` é texto orientativo (“conforme PGE/PVA/IN”), não data inventada
- Overrides exigem `overrideReason` + `sourceId` (`assertCalendarOverride`)

## iCal

`buildIcalReminder` exporta lembrete ancorado na **competência** (`periodKey-01`), explicitamente marcado como **não** sendo vencimento legal.

## UI

`/app/ops` · link no closing cockpit.
