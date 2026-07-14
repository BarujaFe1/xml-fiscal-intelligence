# Homologação oficial (Fase 9)

**Status:** processo `internal_beta`  
**UI:** `/app/homologation` · Lab: `/app/validators-lab`  
**IDB:** `xfi_homologation_v1`

## Fluxo

1. Playbook da obrigação  
2. Fixture sintética → geração (`contentHash`)  
3. Rodar programa oficial **fora** do produto  
4. Registrar no lab → bridge vault  
5. `homologationGrade` → revisão humana §28  
6. Célula `validated_scope_ready` (**não** altera maturidade global sozinha)

## Transmissão

`buildTransmissionChecklist` — flag + cert A1/A3 + agente local + SoD + ambiente restrito.

## Runbook

Ver `SUPPORT_RUNBOOK_DONT_PROMISE` em `src/modules/homologation/platform.ts`.
