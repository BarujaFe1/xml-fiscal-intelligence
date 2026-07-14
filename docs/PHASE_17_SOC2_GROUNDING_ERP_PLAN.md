# Plano detalhado — Fase 17: SOC2 Type I prep · grounding assist · ERP live #3

**Status:** implementada em `feat/soc2-grounding-erp3` (local, sem push).  
**Próximo:** [`PHASE_18_CAMPAIGNS_PARTNER_BILLING_MOBILE_PLAN.md`](PHASE_18_CAMPAIGNS_PARTNER_BILLING_MOBILE_PLAN.md).  
**Maturidade:** assurance `official_validator_beta` (prep).  
**Sem** relatório SOC2 emitido. **Sem** inventar tributos. **Sem** production global.

## Entregue

- [x] SOC2 readiness checklist + waivers · SoA draft
- [x] Evidence binder export CI (`exportAssuranceBinderCi`)
- [x] Assist grounded com `sourceIds` (catálogo oficial); ban alíquota/vencimento
- [x] SAP live piloto #3 gated (`XFI_ALLOW_LIVE_ERP` + `XFI_SAP_OAUTH_TOKEN`)
- [x] UI `/app/assurance` · status API · tests · migration · docs · plano Fase 18

## UI / docs

- `/app/assurance` · `docs/ASSURANCE.md` · migration `202607140018_assurance.sql`

## Não claims

- Produto não emite SOC2 Type I
- FEATURE_GUIDED_ASSIST permanece default-off
- SAP HTTP synth apenas

## Kickoff

**“aplique Fase 17”** — concluído.
