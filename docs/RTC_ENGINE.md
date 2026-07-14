# RTC Engine — Reforma Tributária do Consumo (Fase 8)

**Status:** `development`  
**Branch:** `feat/rtc-cbs-ibs-foundation`  
**IDB:** `xfi_rtc_v1` · UI: `/app/rtc`

## Princípios

- Zero alíquota/valor inventado (`rateExplicit` / `taxAmountExplicit` só se presentes)
- `sourceId` obrigatório em fatos manuais com alíquota
- EFD-Contribuições **nunca** é apagada — dualidade documentada
- `rule_set_versions` com `activated=false`
- Simulador atrás de `FEATURE_RTC_SIMULATOR` (default off)
- Parsing atrás de `FEATURE_RTC_PARSING`

## Módulos

| Path | Função |
|------|--------|
| `types.ts` | Fatos CBS/IBS/CRTB/IS |
| `period.ts` | Split pré/transição/pós |
| `rule-sets.ts` | NTs catalogadas |
| `dual-contrib.ts` | Reconciliação × créditos Contrib |
| `extract.ts` | XML → fatos honestos |
| `simulator.ts` | Impacto com/sem crédito legado |
| `readiness.ts` | Gate lab |
| `maturity.ts` | Perfil do módulo |

## Fora

- Transmissão oficial RTC
- Substituir PIS/COFINS no Bloco M
- Hardcode de alíquotas “típicas”
