# Data Model

## Runtime (BatchStore / IndexedDB)

See `src/types/index.ts`: `Batch`, `DocumentSummary`, `DocumentItem`, `AuditFinding`, `DocumentRelationship`, `ImportLog`.

## Postgres

- Baseline: `supabase/schema.sql`  
- Enterprise additive: `supabase/schema-enterprise.sql`  

Key enterprise entities: `companies`, `import_batches`, `fiscal_documents`, `audit_findings`, `document_relationships`, `saved_searches`, `custom_rules`, `import_logs`, `user_actions`.
