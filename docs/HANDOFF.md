# Handoff — Enterprise upgrade

Branch: `feat/fiscal-intelligence-enterprise-upgrade`  
Date: 2026-07-09

## What was implemented

### Core (Priority 1)

- Types enterprise: NFCE, EVENT, CANCELATION, CORRECTION_LETTER; findings; relationships; import logs; CFOP classification fields; xmlHash / incremental counters  
- Parser: detect events/NFC-e; classify operation via CFOP; nature/cfopMain on documents  
- Import: SHA-256 per XML; in-batch dup by hash/key; **incremental** skip via known hashes from IndexedDB  
- Import logs + progress messages  
- Quality score still computed; NFC-e counted with NF-e  

### Product (Priority 2 partial)

- Audit engine → `BatchStore.findings` + UI `/app/audit` and `/app/batches/[id]/audit` (status triage)  
- Relationships NF-e↔CT-e / duplicates → UI global + per batch  
- SPED preview tree (diagnostic only)  
- AI mock + SELECT SQL guard (`/app/ai`)  
- XSD / signature validators as documented stubs  
- Sidebar + command palette + batch tabs updated  
- Upload disclaimer + incremental checkbox  

### Platform prep

- `.gitignore` private-* + certs  
- `.env.example` AI/XSD/DuckDB flags  
- `supabase/schema-enterprise.sql`  
- `docs/openapi.yaml`  
- Full docs set (ARCHITECTURE, IMPORT, XML_PARSING, SECURITY, HANDOFF, …)  
- README portfolio + fiscal disclaimer  

## What was prepared (not fully wired)

- DuckDB/Parquet module (docs only)  
- Full REST surface beyond batches  
- Postgres persistence / multi-user RLS UI  
- Real XSD schemas and crypto signature verify  
- Custom rules no-code builder  
- OCR/PDF  
- React Flow graph visualization  

## Pending / next steps

1. Apply `schema-enterprise.sql` and migrate BatchStore → Postgres  
2. Embed official XSDs under `/schemas` when licensed/available  
3. DuckDB worker for large OLAP  
4. Playwright e2e on upload → audit  
5. Optional FastAPI parser for huge lots  

## Commands run

```bash
npm run typecheck   # pass
npm run test        # 28 tests pass
npm run lint        # clean (after hook fix)
npm run build       # (run on handoff)
```

## How to test locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

1. Upload `samples` ZIP or real ZIP from `private-imports/`  
2. Enable incremental and re-upload same ZIP → should skip known hashes  
3. Open lote → Auditoria / Relações / SPED  
4. `/app/ai` mock chat + SQL guard  

### Real lot

Place ZIP only under `private-imports/` or `private-test-data/`. Never commit.

## Deploy

```bash
git push -u origin feat/fiscal-intelligence-enterprise-upgrade
# PR → merge → Vercel
```

On Vercel, IndexedDB remains the browser source of truth for large ZIPs.

## Fiscal limitations / risks

- Not official SPED/PVA; SPED UI is preview  
- Audit findings are heuristics — false positives expected  
- Signature/XSD not cryptographically complete  
- AI must stay mock unless user consents + masking  
- No SEFAZ scraping  

## Acceptance checklist

| Criterion | Status |
|-----------|--------|
| Install / build | OK |
| ZIP/XML import | OK (browser) |
| NFe/CTe/NFSe detect | OK |
| Duplicates hash/key | OK |
| Incremental | OK |
| Multi items | OK (existing) |
| Flatten / JSON | OK |
| Search / filters / export / dashboard | OK (prior MVP) |
| Audit findings | OK |
| Docs + no real data committed | OK |
| HANDOFF | This file |
