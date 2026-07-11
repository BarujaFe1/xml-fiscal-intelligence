# Phase 0 Handoff — SaaS SPED Platform

## Objetivo da fase

Auditar o repositório e produzir o plano mestre SaaS + análise de lacunas EFD ICMS/IPI **sem implementar** autenticação, billing ou gerador SPED.

## Diagnóstico realizado

- Branch criada: `feat/saas-sped-platform` (from `master` @ enterprise merge)
- Quality gates: lint ✅ · typecheck ✅ · 28 tests ✅ · build ✅
- Produto atual = inteligência fiscal em IndexedDB + preview SPED diagnóstico
- Auth/billing/jobs/Postgres runtime = ausentes (SQL sketches only)
- Impostos de item ainda em `taxJson` bruto — bloqueia C170/C190/E110 sérios

## Decisões arquiteturais (propostas)

- Next.js + Supabase + Stripe (BillingProvider abstrato)
- Plugins de obrigação versionados; EFD ICMS/IPI primeiro
- Fila inicial: Postgres `SKIP LOCKED` (a confirmar)
- IA apenas explicativa
- Preview atual vira consumidor de readiness — não gerador

## Arquivos criados

- `docs/CURRENT_STATE_AUDIT.md`
- `docs/SAAS_SPED_MASTER_PLAN.md`
- `docs/EFD_ICMS_IPI_DATA_GAP_ANALYSIS.md`
- `docs/EFD_ICMS_IPI_SUPPORT_MATRIX.md`
- `docs/MIGRATIONS_PROPOSAL.md`
- `docs/PHASE0_HANDOFF.md` (este)

## Arquivos alterados

- Nenhum código de aplicação nesta fase.

## Migrations

- Apenas proposta em `docs/MIGRATIONS_PROPOSAL.md` (packs 001–008). Não aplicadas.

## Testes criados

- Nenhum novo (baseline 28 passando).

## Comandos executados

```bash
git checkout master && git pull && git checkout -b feat/saas-sped-platform
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

## Resultados

Todos os gates verdes. 4 vulnerabilidades moderadas npm (tratar na CI da Fase 1).

## Funcionalidades entregues

- Auditoria completa + plano por fases + matriz de suporte + gap analysis + proposta de migrations.

## Funcionalidades ainda não entregues

- Tudo das Fases 1–9 (auth, billing, jobs, gerador EFD, PVA, etc.).

## Riscos conhecidos

- Ver `CURRENT_STATE_AUDIT.md` §10.
- Risco comercial se UI SPED for interpretada como geração oficial.

## Passos manuais necessários

1. Revisar docs da Fase 0.
2. Responder decisões do proprietário em `SAAS_SPED_MASTER_PLAN.md`.
3. Aprovar início da Fase 1.

## Variáveis de ambiente

Sem novas vars nesta fase. Futuras: Supabase, Stripe, flags de privacy mode (ver `.env.example` atual).

## Como testar localmente

```bash
npm run dev   # app atual inalterado
```

## Como validar em homologação

N/A — sem deploy desta fase ainda.

## Próxima fase recomendada

**Fase 1 — Fundação SaaS:** Supabase Auth SSR, workspaces, memberships, RLS, companies/establishments, testes de isolamento.

Aguardar validação explícita do proprietário antes de mudanças estruturais grandes.
