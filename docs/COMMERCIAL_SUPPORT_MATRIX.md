# Commercial Support Matrix

**Regra:** espelhar apenas `ObligationMaturity` real. Nunca vender “produção” sem `validated_scope` + evidência.

Gerada por `buildCommercialSupportMatrix()` — `productionClaimAllowed` é sempre `false` nesta fase; células com maturity &lt; `validated_scope` exibem banner **não produção**.

Claims de `validated_scope` comerciais só via `commercialValidatedScopeClaims(n)` quando existem cenários `validated_scope_ready` (Fase 9) — **não** pelo perfil global da obrigação.

| Recurso | Plano (hint) | Maturidade |
|---------|--------------|------------|
| Import XML + lotes | free | — |
| Masters / closing / ops | starter | foundation+ |
| EFD ICMS/IPI | pro | internal_beta |
| EFD-Contribuições | pro | internal_beta |
| ECD / ECF / Reinf | enterprise_beta | development |
| Transmissão / certificado | future | exige validated_scope + política |

API: `GET /api/v1/commercial-matrix` (X-Api-Key).  
UI: `/app/ops`.
