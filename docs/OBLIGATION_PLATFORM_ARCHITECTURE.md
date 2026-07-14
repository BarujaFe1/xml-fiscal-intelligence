# Obligation Platform Architecture

**Status:** Fase 1 (fundação) — branch `feat/obligation-platform-foundation`  
**Não declarar produção comercial universal.**

## Objetivo

Uma plataforma compartilhada para EFD ICMS/IPI, EFD-Contribuições, ECD, ECF e EFD-Reinf — com maturidade honesta, fontes oficiais, cockpit de fechamento, dados mestres e laboratório de validadores.

## Layout de código

```text
src/modules/obligations/
  core/
    maturity.ts
    types.ts          # FiscalObligationPlugin (compat + evaluateReadiness alias)
    pipe.ts
    registry/         # ids, maturity-profiles
    sources/          # official catalog
    readiness/
    manifests/
    validators/       # official-lab
    workflows/        # closing + calendar (sem datas inventadas)
  efd-icms-ipi/
  efd-contribuicoes/
  ecd/
  ecf/
  reinf/
src/modules/master-data/
src/lib/store/closing-cockpit.ts
```

## Contratos

- Plugins existentes continuam em `detectRequiredData` / `validate`; aliases `evaluateReadiness` / `validateInternally` opcionais.
- `ObligationMaturity` substitui `active|stub`.
- Geração permanece assistida + manifesto + hash; transmissão fora de escopo até evidência.

## Persistência

| Dado | Onde |
|------|------|
| Lotes / parse | IndexedDB |
| Empresas | local-cadastro (+ sync cloud opcional) |
| Cockpit fechamento | IndexedDB `xfi_closing_v1` |
| Lab.validadores | localStorage (+ PVA route existente para EFD) |
| Snapshots lote | Storage privado `xml-batches` |

## Próximas fases

2 EFD ICMS/IPI commons + PVA · 3 Reinf restrito · 4 ECD engine · 5 ECF · 6 Contribuições histórica/2026
