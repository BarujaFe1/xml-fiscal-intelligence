# AI Removal Report

**Date:** 2026-07-14  
**Branch:** `feat/cloud-multiuser-official-efd`

## Removido

| Item | Ação |
| ---- | ---- |
| `src/modules/ai/index.ts` | Apagado |
| `src/modules/ai/provider.ts` | Apagado |
| Menu `/app/ai` (sidebar + command palette) | Removido |
| Feature flags `ai` / `ENABLE_AI*` / `AI_PROVIDER` / keys | Removidos de `.env.example` e flags |
| Entitlement `hasAiExplanations` | Removido do runtime + migration strip JSON |
| Card “Assistente IA” em billing | Removido |
| Testes dependentes de MockAiProvider | Substituídos por mask/SQL guard |

## Preservado (não é produto de IA)

| Item | Motivo |
| ---- | ------ |
| `assertSafeSelectSql` → `src/lib/security/sql-guard.ts` | Segurança SQL |
| `maskFiscalText` → `src/lib/security/mask-fiscal.ts` | Privacidade em logs/UI |

## Rota legada

`/app/ai` → `permanentRedirect("/app")` (sem chat).

## Docs a não reviver como feature

- `docs/AI_RAG.md` — marcar como histórico / removido  
- Referências em HANDOFF / SECURITY — atualizadas nesta passagem  

## Teste de regressão

`tests/unit/ai-removed.test.ts` — garante ausência de href `/app/ai` no sidebar e ausência de `ENABLE_AI` no `.env.example`.
