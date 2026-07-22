# Correction Log — 06/2026, perfil A

| Data | Evento | Responsável | Evidência |
|---|---|---|---|
| 2026-07-15 | PVA rejeitou o TXT (2 erros, categoria Campo obrigatório) | usuário | screenshot de resumo |
| 2026-07-15 | Infraestrutura de importação PVA implementada (página + tipos + migration) | agente | `src/app/app/obligations/efd-icms-ipi/pva/page.tsx` |
| 2026-07-15 | Pré-validador de campos obrigatórios implementado (genérico) | agente | `src/modules/obligations/efd-icms-ipi/prevalidate.ts` |
| PENDENTE | Obter relatório detalhado do PVA (registro/campo/linha) | usuário | `blocked_external` |
| PENDENTE | Corrigir origem dos 2 campos e gerar Generation 2 (imutável) | — | depende do relatório detalhado |
| PENDENTE | Rodar PVA novamente e registrar novo resultado | usuário | `blocked_external` |

## Regra aplicada

Não foram inventados valores para os campos ausentes. A geração original é
preservada e classificada como `pva_rejected`. Nenhuma geração substituta foi
criada como "corrigida" sem evidência do PVA.
