# Performance

## Current mitigations

- Client-side ZIP parse (avoid Vercel ~4.5MB body limit)  
- Optional drop of `rawJson` / fields array to shrink IDB payload  
- Progress callbacks every N files  
- Incremental import skips known hashes  

## Enterprise targets

- Server-side pagination + table virtualization  
- Parallelism capped (`IMPORT_PARALLELISM`)  
- DuckDB for OLAP off the transactional path  
- Compression / streaming for large exports  
- Indexes listed in `schema-enterprise.sql`  
