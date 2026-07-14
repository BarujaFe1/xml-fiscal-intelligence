# EFD-Reinf Event Engine

**Status:** Fase 3 implementada (local) — maturidade `development`  
**UI:** `/app/reinf` · **API:** `/api/reinf/submit` (dry-run)  
**Migration:** `supabase/migrations/202607140004_reinf_event_engine.sql`

## Componentes

| Módulo | Path |
|--------|------|
| Catálogo versionado | `reinf/catalog/events-2026.1.json` |
| Lifecycle | `reinf/lifecycle.ts` |
| XML builders | `reinf/xml/builders.ts` |
| Agente local (stub) | `reinf/signer/local-agent.ts` |
| WS client | `reinf/ws/client.ts` |
| DCTF import | `reinf/dctf/reconcile.ts` |
| IndexedDB | `lib/store/reinf-events.ts` |

## Flags

- `FEATURE_REINF_SUBMIT` — default **false**
- `FEATURE_REINF_SUBMIT_PRODUCTION` — exige submit + produção

## Segurança

- PFX/senha **nunca** no browser ou logs
- Assinatura apenas via agente localhost (contrato documentado; stub para testes)
- Ambiente default `restricted`

## Não feito nesta fase

Endpoints HTTP oficiais RFB acoplados · XSD completo · R-2020/R-4010 · login DCTFWeb
