# DuckDB Analytics

## Status

**Prepared / not wired in runtime.** Priority 3 in the enterprise plan.

## Goals

- Export documents/items to DuckDB for OLAP  
- Dashboard aggregations (CFOP, NCM, emitters, taxes)  
- Parquet export/import  
- Period comparison  

## Proposed module

`src/modules/analytics/duckdb`

```ts
// planned API
exportToDuckDb(store: BatchStore, path: string): Promise<void>
runOlapQuery(sql: string): Promise<unknown[]>
exportParquet(table: string, outPath: string): Promise<void>
```

## Env

```env
ENABLE_DUCKDB=false
DUCKDB_PATH=./private-data/analytics.duckdb
```

## Constraints

- Keep DuckDB files under `private-data/` (gitignored)  
- Never commit Parquet with real fiscal data  
- Prefer server/local Node — not browser WASM for large lots initially  
