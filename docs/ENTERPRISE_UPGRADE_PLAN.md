# Enterprise Upgrade Plan — XML Fiscal Intelligence

> Branch: `feat/fiscal-intelligence-enterprise-upgrade`  
> Data: 2026-07-09

## 1. Estado atual

Produto MVP funcional com:

- Upload ZIP processado no **navegador** (bypass do limite ~4.5MB Vercel)
- Persistência **IndexedDB** + filesystem local opcional
- Parser NF-e / CT-e / NFS-e + flatten + itens
- Dashboard, filtros densos (URL sync), busca, quality score
- Partes (fornecedores/clientes), comparador mês a mês
- Command palette (Ctrl+K), presets de export Excel
- Samples anonimizados, docs básicas, schema Supabase preparado
- Deploy: https://xml-fiscal-intelligence.vercel.app

### Diagnóstico (2026-07-09)

| Check | Resultado |
|-------|-----------|
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm test` | 15 testes OK |
| `npm run build` | OK |

## 2. Arquitetura atual

```
Browser (parse ZIP + IndexedDB)
  └─ Next.js App Router (UI + API routes leves)
       ├─ Parser TS (fast-xml-parser)
       ├─ Analytics in-memory
       └─ Export ExcelJS no client
```

Limitações:

- Sem Postgres/DuckDB em produção ainda
- Sem multi-tenant real / Auth
- Sem XSD/assinatura configurados
- Sem SPED / IA / OCR
- Persistência Vercel efêmera (IDB por dispositivo)

## 3. Principais problemas

1. Escalabilidade: lotes grandes no browser (memória)
2. Governança: sem RLS/workspaces reais
3. Validação fiscal incompleta (XSD/assinatura)
4. Relacionamentos e auditoria ainda superficiais
5. Export Parquet/DuckDB ausentes
6. SPED/IA/OCR não iniciados

## 4. Arquitetura alvo

```
UI (Next.js) ── API ── Postgres (transacional + RLS)
                 │
                 ├── Workers (ETL / ZIP / XSD)
                 ├── DuckDB + Parquet (analytics)
                 ├── Storage (XML/PDF)
                 └── AI/RAG (opt-in, mascarado)
```

Módulos sob `src/modules/*` + schema enterprise em `supabase/schema-enterprise.sql`.

## 5. Fases

| Fase | Escopo | Status neste PR |
|------|--------|-----------------|
| 1 Base sólida | gitignore, env, docs, seed, módulos | ✅ |
| 2 Import/ETL | incremental, hash, duplicados, logs | ✅ (client + API) |
| 3 Parser avançado | tipos EVENT/CANCEL, relacionamentos | ✅ parcial |
| 4 Search/filters | já existe + saved searches types | ✅ parcial |
| 5 Exports | Excel/CSV/JSON + Parquet stub | ✅ + stub |
| 6 Auditoria | engine de findings | ✅ |
| 7 SPED | tree preview + lineage stub | ✅ stub UI |
| 8 IA/RAG | mock provider | ✅ stub |
| 9 Admin/API | OpenAPI draft | ✅ draft |
| 10 Performance | índices SQL, docs | ✅ schema |

## 6. Riscos

| Risco | Mitigação |
|-------|-----------|
| Dados fiscais reais no git | private-* gitignored + samples fake |
| Promessa SPED oficial | disclaimer + modo diagnóstico |
| XSD incompleto | status `not_configured` até schemas versionados |
| Assinatura jurídica | validação técnica apenas |
| IA com dados sensíveis | `ENABLE_AI=false`, masking |
| Browser OOM em ZIP enorme | documentar worker/DuckDB como next |

## 7. Priorização deste upgrade

**Prioridade 1 (implementar agora):**

1. Plano + pastas private + env + disclaimer
2. Tipos enterprise + hash SHA-256 + duplicidade
3. Import incremental (skip hash conhecido)
4. Motor de auditoria + findings na UI
5. Relacionamentos NF-e↔CT-e / eventos
6. Classificação CFOP básica
7. Validadores XSD/assinatura (stubs honestos)
8. Schema SQL enterprise + OpenAPI draft
9. Docs + testes + HANDOFF

**Prioridade 2 (parcial):**

- UI Audit / Relationships / SPED preview / AI mock
- Saved searches (tipos + store local)
- Quality score por documento

## 8. Critérios de aceite (este PR)

- [x] Branch criada
- [x] Build/test passam
- [x] Duplicidade por hash/chave
- [x] Import incremental
- [x] Auditoria gera findings
- [x] Relacionamentos básicos
- [x] Docs atualizadas
- [x] Sem dados reais commitados
- [x] HANDOFF.md

## 9. Disclaimer fiscal

Este sistema auxilia análise, organização, auditoria e diagnóstico fiscal, mas **não substitui** validação contábil/fiscal profissional, legislação aplicável, consultoria tributária, nem o PVA/SPED oficial.
