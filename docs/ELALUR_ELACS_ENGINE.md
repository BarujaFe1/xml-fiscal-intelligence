# e-Lalur / e-Lacs Engine

**Status:** `development` (Fase 5) — modelo operacional local + espelho Supabase.

## Modelo

- **Parte A:** adições, exclusões, compensações (`ElalurPartALine`) — conta, valor, dispositivo legal, origem, aprovação.
- **Parte B:** saldos de prejuízo / base negativa (`ElalurPartBBalance`) — abertura, movimentos, fechamento.
- **Versões:** `ElalurSnapshot.version` + `contentHash`; `locked` torna imutável no IDB.
- **Diff:** `diffElalur(before, after)` → linhas add/remove/change + `impactSummary`.

## Persistência

- Browser: IndexedDB `xfi_ecf_v1` store `elalur`
- Cloud: `ecf_elalur` (`202607140006_ecf_engine.sql`)

## UI

Cockpit `/app/ecf` — gravar linhas Parte A manuais; diff vs vazio mostrado como impacto.

## Limites

- Não calcula IRPJ sozinho; o motor gated consome Parte A se a flag estiver on.
- Sem scraping RFB; dispositivos legais são informados pelo usuário.
- Retificação: nova versão + lock da anterior (não sobrescrever locked).
