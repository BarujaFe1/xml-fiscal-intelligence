# Roadmap

## Done in enterprise upgrade (this branch)

- Modular modules: audit, relationships, validation stubs, SPED preview, AI mock  
- Incremental import by SHA-256  
- CFOP classification on parse  
- Audit + relationships persisted in BatchStore  
- UI: `/app/audit`, `/relationships`, `/sped`, `/ai` + batch tabs  
- Docs + OpenAPI draft + `schema-enterprise.sql`  
- Hardened `.gitignore` / `.env.example` / private folders  

## Next

1. Wire Postgres + RLS for multi-user  
2. DuckDB/Parquet analytics module  
3. XSD schemas + real signature crypto checks  
4. Custom rules no-code builder  
5. OCR/PDF compare  
6. Full REST surface from `openapi.yaml`  
7. React Flow relationship graph visualization  

See `docs/ENTERPRISE_UPGRADE_PLAN.md` and `docs/HANDOFF.md`.
