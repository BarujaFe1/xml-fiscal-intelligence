# Assurance (Fase 17)

**Maturidade plataforma:** `official_validator_beta` (prep)  
**UI:** `/app/assurance`  
**Migration:** `supabase/migrations/202607140018_assurance.sql`

## Capacidades

- Checklist SOC2 Type I readiness + waivers documentados (sem emitir relatório)
- Statement of Applicability draft
- Evidence binder export CI (`exportAssuranceBinderCi`)
- Assist grounded com `sourceIds` do `OFFICIAL_SOURCE_CATALOG`
- SAP live piloto gated (`XFI_ALLOW_LIVE_ERP` + `XFI_SAP_OAUTH_TOKEN`; HTTP via `XFI_ERP_HTTP`)

## Flags / env

| Env | Papel |
|-----|--------|
| `FEATURE_GUIDED_ASSIST` | Default off — review antes de on |
| `XFI_ALLOW_LIVE_ERP` | Gate live Omie/TOTVS/SAP |
| `XFI_SAP_OAUTH_TOKEN` | Secret SAP (nunca no git) |
| `XFI_ERP_HTTP` | Libera path HTTP synth |

## Não claims

- Produto **não** emite SOC2 Type I
- Sem inventar alíquotas/vencimentos
- Sem production global
- SAP HTTP synth — sem protocolo proprietário no repo

## Relatório §28

Ver `section28Phase17Report()` e `/app/assurance`.
