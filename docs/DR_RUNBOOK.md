# DR Runbook — multi-região (Fase 13)

**Status:** draft operacional · maturidade scale `internal_beta`  
**Não cobre:** PVA / PGE / Programas ECD·ECF / ambiente Reinf RFB / DCTFWeb.

## Targets draft

| Métrica | Valor |
|---------|-------|
| RPO | 24h |
| RTO | 72h |

Código: `defaultDrTargets()` · UI `/app/scale`.

## Inventário

Ver `PERSISTENCE_INVENTORY` — IndexedDB (cliente), Supabase, Blob, memória de processo, fixtures git.

## Procedure backup/restore (staging)

1. Export binder + audit  
2. Snapshot Supabase staging  
3. Restaurar Blob refs  
4. Re-hidratar IDB via migrate  
5. Registrar drill (`environment=staging`)  
6. Re-lab cenários críticos  

## Drill documentado

Executar **Executar drill staging** em `/app/scale` — `countsAsEvidence=true` só em staging.

## Health

`GET /api/v1/status` → `scale.regions` (síntese; não é SLO cloud real).
