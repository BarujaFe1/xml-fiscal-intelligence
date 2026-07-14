# Ops Platform (Fase 7)

**Maturidade plataforma:** `internal_beta`  
**Branch:** `feat/ops-platform-phase7`  
**UI:** `/app/ops` · **OpenAPI:** `/api/v1/openapi.json`

## Capacidades

Ver `PLATFORM_OPS_CAPABILITIES` em `src/modules/ops/platform.ts`.

## Auth API

- Header `X-Api-Key`
- Env `OPS_API_KEYS` (lista)
- Dev: `local-dev` se keys não configuradas e não-production
- `Idempotency-Key` em POST evidências

## Sem

- Elevar obrigação para `production` via UI
- Endpoints de transmissão Reinf
- Datas de vencimento inventadas
