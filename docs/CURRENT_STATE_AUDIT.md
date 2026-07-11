# Current State Audit — XML Fiscal Intelligence

> Branch: `feat/saas-sped-platform`  
> Date: 2026-07-10  
> Phase: **0 — Audit only** (no SaaS/SPED implementation in this document)

## 0. Quality gates (executed)

| Command | Result |
|---------|--------|
| `npm install` | OK (621 packages; 4 moderate advisories) |
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm run test` | OK — **28** tests / 5 files |
| `npm run build` | OK — Next.js 16.2.10 |

Production site (pre-SaaS): https://xml-fiscal-intelligence.vercel.app

---

## 1. Architecture today

```text
Browser
  ├─ ZIP parse (jszip + zip-slip guards)
  ├─ fiscal parser (fast-xml-parser)
  ├─ audit + relationships + quality
  └─ IndexedDB BatchStore  ← source of truth on Vercel

Next.js App Router
  ├─ UI /app/*
  ├─ API /api/batches* (filesystem JSON; no auth)
  └─ optional FS under data/batches (ephemeral on Vercel)

Supabase
  └─ schema.sql + schema-enterprise.sql  ← not wired to app runtime
```

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind 4 · Vitest · ExcelJS · Recharts · Zod · no `@supabase/*` · no Stripe · no middleware.

---

## 2. Routes

### Pages

| Route | Role |
|-------|------|
| `/` | Marketing / landing |
| `/app` | Overview |
| `/app/upload` | Client ZIP import + incremental |
| `/app/batches`, `/app/batches/[id]` | History + dashboard |
| `/app/batches/[id]/documents|items|parties|fields|quality|exports|compare|audit|relationships|sped` | Batch tools |
| `/app/search` | Global search (IDB) |
| `/app/audit`, `/relationships`, `/sped`, `/ai` | Cross-batch / stubs |
| `/app/settings` | Local prefs (masking) |

### API

| Route | Auth | Persistence |
|-------|------|-------------|
| `GET/POST /api/batches` | None | FS |
| `POST /api/batches/import` | None | FS metadata |
| `GET/DELETE /api/batches/[id]` | None | FS |
| `GET .../export` | None | FS |
| `GET .../documents/[documentId]` | None | FS |
| `GET /api/search` | None | FS |

**No `middleware.ts`.** No tenant isolation at API layer.

---

## 3. Modules & libraries

### `src/modules`

| Module | Status | Notes |
|--------|--------|-------|
| `sped/preview.ts` | Diagnostic tree only | 0000/0150/0200/C100/C170/C190/Bloco 9 — **no TXT** |
| `audit/fiscal-audit-engine.ts` | Working heuristics | Findings in BatchStore |
| `relationships/index.ts` | Working | NF-e↔CT-e, duplicates |
| `ai/index.ts` | Mock | SELECT guard only |
| `validation/xsd-validator.ts` | Stub | `not_configured` |
| `validation/xml-signature-validator.ts` | Stub | Detect Signature node |

### `src/lib` (preserve)

Parser (`detect` / `extract` / `flatten`), ZIP extract, quality score, analytics filters, search, Excel export, CFOP table, SHA-256, IDB + FS stores, process-memory pipeline.

---

## 4. Persistence model

| Layer | Used in prod? | Notes |
|-------|---------------|-------|
| IndexedDB `BatchStore` | **Yes** (primary) | Per browser / device |
| Filesystem `data/batches` | Local / API only | Ephemeral on Vercel |
| Postgres (Supabase) | **No** | SQL files only |
| Object storage | **No** | — |

`BatchStore` shape: `batch`, `documents`, `items`, `fields?`, `errors`, `exports`, `findings?`, `relationships?`, `importLogs?`.

---

## 5. Database schemas (prepared, not applied)

### `supabase/schema.sql`

`profiles`, `workspaces`, `workspace_members` (roles: owner/admin/member/viewer), `batches`, `documents`, `document_items`, `document_fields`, `parse_errors`, `exports`.

RLS: enabled on main tables; `is_workspace_member`; **gaps:** no workspace insert policy, no `workspace_members` policies, no `profiles` RLS.

### `supabase/schema-enterprise.sql`

`companies`, `import_batches`, `fiscal_documents`, `audit_findings`, `document_relationships`, `saved_searches`, `custom_rules`, `import_logs`, `user_actions`.

**No RLS** on enterprise tables. **No billing**, **no establishments**, **no obligation generations**, **no rule_sets**.

---

## 6. Import pipeline (working)

1. Client reads ZIP → `processZipBatchInMemory`  
2. Safe extract → parse → SHA-256 → incremental skip → CFOP classify  
3. Audit + relationships  
4. Save IDB; best-effort API metadata sync  

Preserved strengths: zip-slip, XXE mitigation (`processEntities: false`), dedup, incremental, progress logs.

---

## 7. What the parser already provides (SPED-relevant)

### Document header (typed)

`accessKey`, `number`, `series`, `model`, `issueDate`, `authorizationDate`, emitter/receiver doc/name/city/uf, `totalValue`, `productsValue`, `freightValue`, `discountValue`, aggregated `taxValue`, `protocol`, `status`, `natureOperation`, `cfopMain`, `operationClassification`, `xmlHash`.

### Items (typed)

`itemNumber`, `code`, `description`, `ncm`, `cfop`, `unit`, `quantity`, `unitValue`, `totalValue`, `discountValue`, **`taxJson` = raw `imposto` blob**.

### Types reserved but **not extracted**

`cest`, `cst`, `csosn` on `DocumentItem`.

### In XML / taxJson but not promoted

ICMS CST/orig/modBC/vBC/pICMS/vICMS; IPI; PIS/COFINS CST/bases; ICMSTot fields (`vICMS`, `vBC`, `vST`, `vIPI`, …) beyond a few totals.

---

## 8. Incomplete / stub features

| Feature | Reality |
|---------|---------|
| SPED | Preview tree — not generation |
| Auth | Absent |
| Multi-tenant | Schema sketch only |
| Billing | Absent |
| XSD / signature crypto | Stubs |
| DuckDB / Parquet | Docs only |
| OpenAPI | Draft; most endpoints 501 |
| Playwright e2e | Dep present; no suite |
| Jobs / workers | Absent |
| Establishments / IE / COD_MUN | Absent |

---

## 9. Test coverage

| File | Scope |
|------|-------|
| `tests/unit/parser.test.ts` | Detect, flatten, extract, quality, search, CSV |
| `tests/unit/zip.test.ts` | Safe ZIP |
| `tests/unit/analytics.test.ts` | Filters, compare |
| `tests/unit/enterprise.test.ts` | CFOP, hash, audit, relationships, stubs, AI SQL, SPED tree |
| `tests/unit/real-zip.smoke.test.ts` | Optional local ZIP |

**Missing for SaaS/SPED:** RLS isolation, auth, billing webhooks, EFD serializer golden files, decimal money, tenant IDOR, Playwright.

---

## 10. Risks

| Risk | Severity | Mitigation direction |
|------|----------|----------------------|
| Selling “SPED válido” from preview | Critical | Keep disclaimer; separate internal vs PVA |
| Floating `number` for money | High | Decimal / centavos / Postgres `numeric` |
| No tenant isolation in APIs | Critical | Auth + RLS before any cloud persist |
| taxJson opaque → wrong C170/C190 | High | Deterministic tax normalizer + tests |
| Mixing layout years | High | Versioned rule_sets by period |
| NFS-e treated as EFD ICMS/IPI | High | Explicit non-applicability rules |
| IndexedDB-only → data loss / no multi-device | Medium | Server storage after auth |
| npm moderate vulns | Low | Audit in CI |

---

## 11. Preserve vs replace

### Preserve

- Client ZIP pipeline + IDB privacy mode  
- Parser detect/extract/flatten  
- Quality score, audit engine, relationships  
- Export Excel/CSV/JSON/HTML  
- UI batch exploration (documents, filters, compare)  
- Fiscal disclaimers and private-* gitignore  

### Replace / supersede

- `sped/preview.ts` as “generator” narrative → become readiness consumer of new obligation engine  
- FS-only APIs without auth → authenticated + storage + jobs  
- Role set `owner/admin/member/viewer` → expand to accountant/fiscal_analyst/etc.  

### Do not invent

- Alíquotas, CST, benefícios, perfil A/B/C, direito a crédito, transmissão SEFAZ/PVA automation.

---

## 12. Migration plan (high level)

1. **Phase 1** — Auth SSR + workspaces + RLS + companies/establishments (keep IDB as optional privacy path)  
2. **Phase 2** — Stripe billing + entitlements  
3. **Phase 3** — Persist imports to Postgres + private storage + jobs  
4. **Phase 4** — Obligation plugin core + versioned rules registry  
5. **Phase 5** — EFD ICMS/IPI controlled MVP (readiness → builders → serializer → lineage)  
6. **Phase 6+** — PVA workflow, advanced blocks, other obligations  

Detailed plan: `docs/SAAS_SPED_MASTER_PLAN.md`.  
Data gaps: `docs/EFD_ICMS_IPI_DATA_GAP_ANALYSIS.md`.  
Support matrix: `docs/EFD_ICMS_IPI_SUPPORT_MATRIX.md`.

---

## 13. Decisions requiring owner approval

See master plan § “Decisões que exigem aprovação”. Critical ones:

1. Stripe as sole billing provider for v1?  
2. Keep browser-only privacy mode alongside SaaS?  
3. First commercial scope: **only** NF-e model 55 + Bloco 0/C/E/9 for perfil X / UF Y?  
4. Job queue: Postgres advisory locks vs Supabase Queues vs external?  
5. A1 certificate storage: **never** in v1?  
6. When to claim “commercial readiness” publicly?
