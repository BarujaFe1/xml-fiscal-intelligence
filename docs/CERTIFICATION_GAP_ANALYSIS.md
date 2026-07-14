# Certification gap analysis — preparação (não certificação)

**Status:** Fase 12 · preparação  
**Claim proibido:** “somos SOC2” / “certificados ISO 27001” sem relatório de auditor externo.

## Objetivo do documento

Mapear controles do produto vs. famílias típicas SOC2 (CC*) e listar lacunas honestas antes de contratar auditoria.

## Controles cobertos no produto

Ver `CONTROL_MATRIX` em `src/modules/enterprise/controls.ts` e export via Evidence Binder (`/app/enterprise`).

| Área | Situação |
|------|----------|
| RBAC + SoD | implemented |
| Audit export sanitizado | implemented |
| Retenção versionada | implemented (≠ parecer jurídico) |
| Secrets fora do git / path scan | partial |
| RLS Supabase | partial (depende de deploy migrations) |
| Live ERP gate | implemented |
| Marketplace re-lab | implemented |
| DR / multi-região | planned (Fase 13) |
| Auditoria externa | out_of_scope até contrato |

## Gaps explícitos

1. Secrets manager: modo `env_only` default; `external_configured` só com `XFI_SECRETS_MANAGER_URL` (Fase 13) — sem rotação automática.
2. Multi-região / DR: inventário + RPO/RTO draft + drill staging (Fase 13) — **sem** SLO cloud real (Fase 14).
3. Sem pen-test / SOC2 Type I report externo (triage de findings existe no produto).
4. DPA/SLA ainda template/draft até jurídico.
5. Omie “live” libera flag + golden; HTTP API ainda bloqueado de propósito.

## Residual risks (pós-F13–F15)

- Health regional em `/api/v1/status` é síntese; SLO `api_status_availability` usa samples staging (F14) — ainda ≠ uptime cloud contratado.
- Metering local ≠ cobrança Stripe sem webhook verificado.
- IndexedDB continua responsabilidade do cliente sem migrate.
- HTTP TOTVS/Omie: path synth mesmo com flags — sem conector proprietário completo.
- Partner white-label é preview — sem contrato jurídico automático.
- Compliance pack contentHash ≠ assinatura notarizada / selo SOC2 (F15).
- Erase LGPD é `fulfilled_partial` — backups/PITR cloud não auto-apagados.

## Próximo passo (humano)

Contratar auditor → usar Evidence Binder + DR runbook + este gap analysis.  
Produto **não** auto-promove `soc2Certified` / `iso27001Certified`.
