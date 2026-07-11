# Phases 1–9 implementation handoff

Branch: `feat/saas-sped-platform`  
Date: 2026-07-10

## Objetivo

Implementar a fundação SaaS + motor determinístico EFD ICMS/IPI (MVP controlado), com scaffolds honestos para fases posteriores.

## Entregue por fase

### Fase 1 — Fundação SaaS
- Supabase SSR browser/server clients
- Middleware session refresh + proteção de rotas SaaS
- Login/signup pages
- Permissions matrix (`src/lib/auth/permissions.ts`)
- Migrations: establishments, invites, RLS hardening

### Fase 2 — Billing
- `BillingProvider` + Mock (idempotent webhooks) + Stripe stub
- Entitlements / plan seeds (no `if (plan==="pro")`)
- `/app/billing` UI
- `/api/billing/webhook`

### Fase 3 — Jobs/storage
- In-memory job queue with idempotency
- Local private storage for generated files
- SQL `import_jobs`

### Fase 4 — Obligation core
- Plugin types + registry
- Money fixed-scale module
- Official sources / rule_set_versions tables

### Fase 5 — EFD ICMS/IPI MVP
- Tax normalizer NF-e
- Readiness checklist (blocking)
- Builders 0000/0150/0190/0200/C100/C170/C190/Bloco9
- Serializer CRLF + hash + manifest + lineage
- UI `/app/obligations/efd-icms-ipi`
- API generate

### Fase 6 — PVA
- `pva/workflow.ts` + `pva_validation_runs` table (import-oriented)

### Fases 7–9
- Stubs for H/K/G advanced + other obligations
- Docs: COMMERCIAL_READINESS, KNOWN_LIMITATIONS, SAAS_ARCHITECTURE

## Comandos

```bash
npm run typecheck
npm run test   # 38 tests
npm run build  # OK
```

## Como testar EFD local

1. `npm run dev`
2. Upload sample ZIP
3. `/app/obligations/efd-icms-ipi` — preencher CNPJ/UF/perfil/atividade/período
4. Gerar TXT — baixar e importar no PVA (validação oficial externa)

## Riscos restantes

Ver `docs/KNOWN_LIMITATIONS.md` e `docs/COMMERCIAL_READINESS.md`.

## Próximos passos manuais

1. Criar projeto Supabase e aplicar `schema.sql` + `schema-enterprise.sql` + `migrations/*`
2. Configurar Auth e Stripe
3. Registrar Guia Prático oficial em `official_sources`
4. Rodar PVA no golden file e anexar resultado
