# Search and Indexing

## Current

Client-side `searchBatchStore` over documents/items/flattened fields in IndexedDB.

## Future (Postgres)

- GIN on `raw_json` / `flattened_json`  
- Indexes on `access_key`, `issue_date`, `cfop_main`, `xml_hash`  
- Full-text on descriptions / nature  
- Server-side pagination — never load entire workspace in the browser  

See `supabase/schema-enterprise.sql`.
