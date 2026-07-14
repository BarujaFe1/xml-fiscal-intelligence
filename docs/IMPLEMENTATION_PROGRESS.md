# Implementation Progress — cloud / EFD / no-AI

**Branch:** `feat/cloud-multiuser-official-efd`  
**Updated:** 2026-07-14

## Concluído

1. Remoção completa da superfície de IA + testes negativos.
2. Cadastro multi-empresa (PDF SIEG) + painel nas obrigações.
3. `EfdGenerationStatus`, `FiscalDecimal`, contratos de repositório.
4. Migração cloud: UUID estável (corrige `ws_local_demo`), fases UI, docs metadados.
5. PVA assistido: status explícito → lifecycle; persistência com service role.
6. Sync empresas → API `cloud_companies`.
7. Migrations `202607140001` / `202607140002`.

## Gates

| Suite | Result |
| ----- | ------ |
| typecheck | pass |
| test | **139** passed / 1 skipped |
| build | pass |

## Ainda pendente / externo

- Upload XML bruto para storage privado em lote
- Apply migrations no projeto Supabase prod
- Homologação PVA com evidências locais
- Multiusuário/convites end-to-end
