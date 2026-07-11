# SaaS SPED Master Plan

> Branch: `feat/saas-sped-platform`  
> First commercial module: **EFD ICMS/IPI (SPED Fiscal)**  
> Principle: incremental, testable, reversible phases — **no SPED generation before SaaS foundation**.

## Vision (honest commercial framing)

> Plataforma de inteligência fiscal, conferência e **geração assistida** da EFD ICMS/IPI para **cenários suportados**, com arquivo destinado à **validação no PVA oficial**.

Never claim: “gera qualquer SPED”, “substitui o PVA”, “SPED válido” from internal checks alone.

---

## Target architecture

```text
src/
  app/
    (public)/          # marketing, pricing, legal
    (auth)/            # login, signup, reset
    (dashboard)/       # product UI
    (admin)/           # platform admin
    api/               # route handlers
  lib/
    auth/ billing/ database/ jobs/ storage/
    security/ observability/ entitlements/
  modules/
    imports/ documents/ reconciliation/ audit/
    obligations/
      core/                 # FiscalObligationPlugin
      efd-icms-ipi/         # first plugin
      efd-contribuicoes/    # stub later
      ecd/ ecf/ reinf/      # stubs
    fiscal-rules/ fiscal-master-data/ validation/ ai/
  workers/
```

### Core plugin contract (target)

```ts
interface FiscalObligationPlugin {
  id: string;
  name: string;
  jurisdiction: "federal" | "state" | "municipal";
  supportedVersions: string[];
  resolveVersion(ctx): Promise<ResolvedRuleSet>;
  detectRequiredData(ctx): Promise<RequiredDataResult>;
  build(ctx): Promise<ObligationBuildResult>;
  validate(build, ctx): Promise<ValidationResult>;
  serialize(build, ctx): Promise<SerializedObligation>;
  createManifest(build, ctx): Promise<GenerationManifest>;
}
```

Rules live in `fiscal-rules` / versioned DB — **never** in React components.

IA: explain only; **never** write obligation records.

---

## Official sources registry (process)

Each rule set must store: URL, title, version, publish date, effective from/to, layout version, PVA version, document hash, last verified, notes.

Initial watchlist (verify before encoding rules — do not hardcode “latest forever”):

| Obligation | Layout watch | Notes |
|------------|--------------|-------|
| EFD ICMS/IPI | Guia Prático ~3.2.2 (2026) / 3.2.3 (announced 2027) | Period-bound |
| EFD-Contribuições | Historical + 2027 transition | Separate plugin |
| ECD / ECF / Reinf | Later phases | Need accounting foundation |

Primary portals: gov.br/sped, Receita Federal download center, state SEFAZ pages. Blogs (e.g. Senior) = didactic only, never validation source.

---

## Phases, complexity, acceptance

Complexity: **S** < 1 week · **M** 1–2 weeks · **L** 2–4 weeks · **XL** 1–2 months (1 senior full-time equivalent, approximate).

### Phase 0 — Audit ✅ (this branch docs)

| Item | Status |
|------|--------|
| CURRENT_STATE_AUDIT | Done |
| SAAS_SPED_MASTER_PLAN | Done |
| EFD data gap + support matrix | Done |
| Migration proposal | Done (below) |

**Accept:** docs reviewed by owner; decisions list acknowledged.

---

### Phase 1 — SaaS foundation · **L**

**Deliver**

- `@supabase/ssr` Auth (email/password, confirm, reset, logout)
- Workspaces, memberships, invites
- Roles: owner, admin, accountant, fiscal_analyst, operator, viewer, billing_manager (+ support_readonly later)
- Companies + **establishments** + tax_profiles (IE, UF, COD_MUN, perfil, atividade)
- RLS on all tenant tables + isolation tests
- Onboarding wizard (workspace → company → establishment)
- Keep IndexedDB import as **privacy/demo** path behind flag

**Accept**

- lint/typecheck/test/build pass  
- User A cannot read User B workspace data (automated test)  
- Server-side permission checks (not UI-only)

**Do not start Phase 2 without this.**

---

### Phase 2 — Billing · **L**

**Deliver**

- `BillingProvider` abstraction + Stripe Checkout / Portal / webhooks
- Plans as data: Trial, Essencial, Profissional, Escritório, Enterprise
- Entitlements (never `if (plan === "pro")`)
- Usage counters with concurrency-safe increments
- Progressive lockout on payment failure

**Accept**

- Webhook signature + idempotency tested  
- Entitlements enforced server-side  
- No incomplete Mercado Pago UI

---

### Phase 3 — Persistence & jobs · **L–XL**

**Deliver**

- Private Storage (signed upload)
- Import jobs: status, retries, backoff, lock, idempotency, DLQ
- Persist documents/items/findings to Postgres
- Zip bomb / size / count limits
- Usage metering on import/export

**Queue choice (proposal):** PostgreSQL job table + `FOR UPDATE SKIP LOCKED` first (fits Supabase, no Redis). Document tradeoffs; revisit if throughput demands.

**Accept**

- Authenticated upload → job → documents visible  
- Malicious ZIP rejected  
- Limits enforced

---

### Phase 4 — Obligation core · **L**

**Deliver**

- Plugin interface + registry
- `official_sources`, `rule_sets`, `rule_set_versions`, record/field definitions
- Decimal money utilities
- Lineage + generation manifest types
- Validation result model (internal levels 1–2)

**Accept**

- Version resolution by period (2025 ≠ 2026 rules)  
- Unit tests for decimal + version picker

---

### Phase 5 — EFD ICMS/IPI MVP (controlled) · **XL**

**Scope proposal (must be approved):**

- Establishment-scoped generation  
- Layout version pinned per period  
- Bloco 0 (0000, 0001, 0150, 0190, 0200, 0400?, 0990)  
- Bloco C for **model 55** with structured tax (C100, C170, C190) where data complete  
- Bloco D **only if** CT-e present and mapped  
- Bloco E minimal (E100/E110) **only with** explicit balances/adjustments or declared N/A  
- Bloco 9 (9900/9990/9999)  
- Readiness checklist blocking generate  
- TXT serializer + golden files  
- Lineage “Ver origem”  
- UI language: “pré-validação interna” / “para importar no PVA”

**Out of scope for first sellable claim:** Bloco H/K/G full, Bloco B, all state specials, auto PVA, transmission.

**Accept**

- Golden file tests  
- No silent fill of missing fiscal decisions  
- Manifest + content hash per generation  
- Support matrix rows marked only with fixtures

---

### Phase 6 — PVA-assisted workflow · **M**

Import PVA report, link issues, version compare, receipt attach. No PVA UI automation.

### Phase 7 — Advanced EFD coverage · **XL**

H, K, G, state rules, benefits, special assessments — per matrix.

### Phase 8 — Integrations · **L**

Public API, webhooks, connectors, accounting office multi-company batch.

### Phase 9 — Other obligations · **XL+**

EFD-Contribuições (historical), ECD/ECF foundation, Reinf, state/municipal plugins — stubs first.

---

## Proposed folder structure (create from Phase 1+)

```text
src/modules/obligations/core/
src/modules/obligations/efd-icms-ipi/{plugin,context,versions,records,builders,validators,calculators,serializers,mappings,lineage,tests}/
src/modules/fiscal-rules/
src/lib/{auth,billing,entitlements,jobs,storage,observability}/
supabase/migrations/   # replace ad-hoc schema dumps
docs/OFFICIAL_SOURCE_REGISTRY.md
```

---

## Migration proposal (summary)

New migration packs (idempotent SQL under `supabase/migrations/`):

| Pack | Contents |
|------|----------|
| `001_identity` | profiles RLS, workspaces CRUD policies, invites, expanded roles |
| `002_org_fiscal` | companies, establishments, tax_profiles, accountants |
| `003_billing` | customers, products, prices, subscriptions, events, entitlements, usage |
| `004_imports_jobs` | import_files, import_jobs, storage paths, locks |
| `005_documents_v2` | normalize tax columns, participants, products, events |
| `006_rules` | official_sources, rule_sets, versions, tables |
| `007_obligations` | generations, records, lineage, validations, manifests, pva_runs |

Full column-level draft: extend `schema-enterprise.sql` → split into migrations in Phase 1 (do not apply destructive prod migrations automatically).

---

## Cronograma técnico (indicative)

| Phase | Complexity | Dependency |
|-------|------------|------------|
| 0 Audit | S | — |
| 1 Auth/tenancy | L | Owner decisions on roles/privacy mode |
| 2 Billing | L | Stripe account + prices |
| 3 Jobs/storage | L–XL | Phase 1 |
| 4 Obligation core | L | Phase 3 (or parallel types-only) |
| 5 EFD MVP | XL | Phases 1+3+4 + approved support matrix |
| 6 PVA workflow | M | Phase 5 |
| 7–9 | XL+ | After commercial MVP |

---

## Decisões que exigem aprovação do proprietário

1. **Billing:** Stripe only for v1? Trial length? Annual discount?  
2. **Privacy mode:** Keep browser-only IndexedDB path in production?  
3. **EFD MVP UF/perfil:** Which UF + perfil (A/B/C) for first golden fixtures?  
4. **Queue:** Confirm Postgres `SKIP LOCKED` vs paid queue product.  
5. **Certificates:** Confirm **no A1 storage** in v1.  
6. **Commercial claim:** Exact wording on landing/pricing.  
7. **Support access:** Temporary audited impersonation — yes/no for v1.  
8. **Data residency:** Supabase region preference.  
9. **Legal:** Who drafts Terms / Privacy / DPA (system provides templates only).  
10. **PVA:** User-run only vs future local helper app (explicit, non-obscure).

---

## Criteria for first sellable version

Must have: auth, workspace, multi-user roles, multi-company/establishment, RLS tests, Stripe trial+checkout+portal+webhooks, entitlements, private storage, async import, audit, EFD readiness, **scoped** TXT generation, internal validation, lineage, manifest, hash, versioning, docs, limitations page, admin basics, observability basics.

Must **not** claim full SPED coverage or official validation without PVA result.

---

## Next step after this audit

**Await owner validation of Phase 0 docs and decisions list.**  
Then start **Phase 1** only: Supabase Auth SSR + tenancy + RLS + companies/establishments.
