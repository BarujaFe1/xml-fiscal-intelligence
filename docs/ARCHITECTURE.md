# Architecture

## Decision

**MVP = full Next.js on Vercel** with local filesystem persistence.

Rationale:

- Fastest path to a portfolio-ready product
- ZIP/XML of a typical monthly batch fits serverless limits with `MAX_UPLOAD_MB` (default 50)
- Single deploy surface
- Clear seam to extract a FastAPI parser later (`PARSER_API_URL`)

## Components

```
Browser
  └─ Next.js App Router (landing + /app/*)
       ├─ API Route Handlers
       │    ├─ POST /api/batches          upload + process ZIP
       │    ├─ GET  /api/batches/:id      batch store
       │    ├─ GET  /api/batches/:id/export
       │    ├─ GET  /api/search
       │    └─ GET  /api/batches/:id/documents/:documentId
       ├─ Parser pipeline (TypeScript)
       │    detect → parse → flatten → extract → quality
       └─ Store: data/batches/{id}.json + xml/
```

## Future split

```
Vercel (Next.js UI + BFF)
   │ PARSER_API_URL
   ▼
FastAPI (defusedxml / lxml, zipfile, polars)
   │
   ▼
Supabase Postgres + Storage + Auth + RLS
```

## Security boundaries

- Never execute ZIP contents
- Reject `..` paths and absolute paths (zip slip)
- Ignore dangerous extensions
- XML parser with `processEntities: false`
- Real XMLs only in gitignored paths
