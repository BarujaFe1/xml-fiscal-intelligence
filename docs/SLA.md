# SLA draft — XML Fiscal Intelligence

**Status:** draft operacional (Fase 11) — **não** é contrato comercial assinado.  
**Fora de cobertura:** uptime PVA / PGE / Programas ECD·ECF / ambiente RFB Reinf / DCTFWeb.

## Metas draft (síntese local)

| Métrica | Meta | Janela |
|---------|------|--------|
| generation_success_rate (estimada) | ≥ 95% | 24h |
| api_availability_synth | ≥ 99% | 24h |
| lab_import_ack | evidências importadas quando houver geração | 7d |
| quota_429_rate | ≤ 5% das chamadas monitoradas | 1h |

Código: `DRAFT_SLA_TARGETS` · `computeSlaSnapshot` em `src/modules/governance/sla.ts`.

## O que NÃO prometemos

1. Disponibilidade dos programas oficiais da RFB.
2. Aprovação automática de obrigações como `production`.
3. Integração ERP live sem contrato + `XFI_ALLOW_LIVE_ERP`.
4. Certificação SOC2/ISO neste draft.
5. Status no produto: `sla=draft` até `commercially_bound` com evidence ref jurídica (Fase 12).

## Incidentes

Seguir [`SUPPORT_RUNBOOK.md`](SUPPORT_RUNBOOK.md) + gates RBAC/SoD antes de transmitir.
