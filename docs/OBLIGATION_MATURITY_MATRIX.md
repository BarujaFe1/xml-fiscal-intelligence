# Obligation Maturity Matrix

Atualizado: 2026-07-14 · Nenhuma célula `validated_scope` / `production`.

| Obrigação | Maturidade | Períodos | Regimes | Escopo | Programa oficial | Último teste |
|-----------|------------|----------|---------|--------|------------------|--------------|
| EFD ICMS/IPI | `internal_beta` | mensal assistido | ICMS via XML NF-e/NFC-e | Blocos 0/C/E commons + audit XML×EFD + UF skeleton | PVA (registro; homologationGrade) | unit Fase 2 (sem aceito PVA ainda) |
| EFD-Contribuições | `internal_beta` | mensal domínio+XML | regimes tipificados | Domínio+Bloco M+dual modes+NTs catalog | PGE (homologationGrade) | unit Fase 6 |
| ECD | `development` | anual ledger/DEMO | n/a | Motor contábil + I200 de ledger | Programa ECD | unit Fase 4 |
| ECF | `development` | anual ledger+mapper | IRPJ gated | Recuperação+mapper+e-Lalur+J050 | Programa ECF | unit Fase 5 |
| EFD-Reinf | `development` | mensal eventos draft | n/a | Catálogo+lifecycle+XML+stub+DCTF CSV | Ambiente restrito (submit off) | unit Fase 3 |
| RTC (CBS/IBS/CRTB) | `development` | mensal/transição | reforma consumo | Domínio+dual Contrib+extract honesto+sim gated | ambiente/NT futuros | unit Fase 8 |

Códigos: ver `ObligationMaturity` em `src/modules/obligations/core/maturity.ts` (RTC usa perfil de módulo em `src/modules/rtc/maturity.ts`).

Perfis: `src/modules/obligations/core/registry/maturity-profiles.ts`.

**Barra para `validated_scope`:** fixture + unit + integration + golden + teste oficial + doc + evidência + revisor.
