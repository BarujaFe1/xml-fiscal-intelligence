# ERP Named Connectors

**Status:** Fase 14 — `omie_live_pilot` + `totvs_live_pilot` gated; placeholders `planned`  
**Regra:** secrets nunca no git; `XFI_ALLOW_LIVE_ERP=1` + vendor secrets; HTTP `XFI_ERP_HTTP=1`.

## Registry

| vendorId | Maturidade | Live |
|----------|------------|------|
| pilot_synth | development | no |
| omie_live_pilot | development→internal_beta se env | gated |
| totvs_live_pilot | development→internal_beta se env | gated |
| totvs_placeholder | planned | no |
| sap_placeholder | planned | no |
| senior_placeholder | planned | no |
| omie_placeholder | planned | no |

Env TOTVS: `XFI_TOTVS_ACCESS_TOKEN` · Omie: `XFI_OMIE_APP_KEY` / `XFI_OMIE_APP_SECRET`  
HTTP: resposta synth — sem protocolo proprietário no repo.

## Não claim

“Integrado nativamente a TOTVS/SAP/Omie em produção” — só pilotos gated + placeholders.
