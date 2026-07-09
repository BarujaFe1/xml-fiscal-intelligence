# Architecture (enterprise upgrade)

## Current runtime (MVP+)

```txt
Browser (Next.js client)
  └─ ZIP parse (jszip) + fiscal parser + audit + relationships
  └─ IndexedDB BatchStore (source of truth on Vercel)

Next.js App Router
  └─ UI /app/*
  └─ API /api/batches* (metadata sync best-effort)
  └─ Optional FS store under data/ (local only)
```

## Target modular layout

```txt
src/
  app/                 # routes
  components/          # UI
  modules/
    audit/             # fiscal-audit-engine
    relationships/     # document graph inference
    validation/        # XSD + XML signature stubs
    sped/              # SPED preview tree
    ai/                # mock RAG + SQL guard
  lib/
    parser/            # detect / extract / flatten
    fiscal/            # CFOP table + classification
    security/          # hash, doc format checks
    store/             # process-memory, idb
    quality/           # health score
    export/            # excel/csv/json
  types/
docs/
supabase/              # schema.sql + schema-enterprise.sql
```

## Data flow (import)

1. User drops ZIP in `/app/upload`  
2. Optional incremental: load known SHA-256 from prior IDB batches  
3. Extract XMLs (zip-slip safe)  
4. Per file: hash → parse → classify CFOP → mark in-batch duplicates  
5. Batch quality score  
6. Audit findings + relationships  
7. Persist `BatchStore` to IndexedDB  

## Persistence strategy

| Environment | Store |
|-------------|--------|
| Vercel / browser | IndexedDB |
| Local Node | optional `data/batches` |
| Future | Postgres (`schema-enterprise.sql`) + object storage for XML |

## Analytics (planned)

DuckDB + Parquet module documented in `docs/DUCKDB_ANALYTICS.md` — not required for Priority 1 acceptance.
