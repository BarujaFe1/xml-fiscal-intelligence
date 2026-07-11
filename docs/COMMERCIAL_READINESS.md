# Commercial readiness & known limitations

## Positioning (allowed)

> Plataforma de inteligência fiscal, conferência e **geração assistida** da EFD ICMS/IPI para **cenários suportados**, com arquivo destinado à **validação no PVA oficial**.

## What works now (engineering)

| Area | Status |
|------|--------|
| XML ZIP import (browser/IDB) | Production-ready MVP |
| Audit / relationships / exports | MVP |
| Auth UI + Supabase SSR clients + middleware session refresh | Ready when env configured |
| Roles / permissions matrix (server helpers) | Implemented |
| Entitlements + plan seeds | Implemented (enforce in generate API) |
| Billing provider + mock webhooks idempotent | Mock ready; Stripe adapter stub |
| Job queue contract + in-memory impl | Ready for tests/dev |
| Private local storage for generated TXT | Ready |
| EFD ICMS/IPI readiness + C100/C170/C190 + serialize + lineage + manifest | **Controlled MVP** |
| PVA report import helper | Stub types |
| EFD-Contribuições / ECD / ECF / Reinf | Stubs only |

## What is NOT ready to sell as “full SPED”

- COD_VER / official guide hash registry not filled from gov.br downloads yet
- E110 apuração automática
- Blocos H/K/G/B
- Multi-UF special rules
- Real Stripe Checkout wiring (needs account + SDK finish)
- Postgres RLS live against a project (migrations provided, not auto-applied)
- End-to-end Playwright tenant isolation against real Supabase
- Transmission / certificate storage

## UI honesty rules

Never show “SPED válido” from internal validation alone.  
Always label: pré-validação interna · para importar no PVA · não substitui consultoria.

## Next commercial milestones

1. Apply migrations on Supabase project + Auth email templates  
2. Wire Stripe Checkout + webhook secret  
3. Register official Guia Prático hash in `official_sources`  
4. Golden file + PVA attach for one UF/perfil scenario  
5. Then expand support matrix cells to SUPPORTED
