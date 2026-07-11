# Performance Benchmark Method — XML Fiscal Intelligence

**Status:** method documented (PERF-001). Fill results after controlled runs.  
**Branch context:** `feat/enterprise-production-hardening`

## Scope

Measure **browser-side** ZIP import (IndexedDB SoT) and optional main-thread parse.
Do **not** treat these numbers as SEFAZ/PVA SLAs.

## Environment checklist

| Item | Record |
| ---- | ------ |
| Machine | CPU / RAM |
| Browser | Chrome/Edge version |
| Node (for unit/e2e) | `node -v` |
| Commit | `git rev-parse --short HEAD` |
| Feature flags | `FEATURE_CLOUD_PROCESSING`, AI off |

## Workloads

| ID | Description | Target |
| -- | ----------- | ------ |
| W1 | Sample ZIP ≤ 50 XMLs | smoke |
| W2 | ~1k NF-e ZIP (~5 MB class) | typical month |
| W3 | Stress: max plan file count / size under `IMPORT_LIMITS` | ceiling |

## Metrics

1. **T_extract** — ZIP list + extract to XML strings  
2. **T_parse** — parse + flatten + quality + audit  
3. **T_persist** — IndexedDB `put`  
4. **Peak JS heap** (Chrome Performance / Memory) if available  
5. **UI responsiveness** — main thread blocked > 50 ms count (optional)

## How to measure (manual)

1. Open `/app/upload` with DevTools Performance.  
2. Enable incremental off for cold import; on for reuse path.  
3. Note progress callbacks (`onProgress`) timestamps from console if instrumented.  
4. Record wall-clock from drop → redirect to batch dashboard.

## Results table (fill in)

| Date | Commit | Workload | Docs | T_total (s) | Notes |
| ---- | ------ | -------- | ---- | ----------- | ----- |
| 2026-07-11 | local | W-synth-100 | 100 | 0.157 | `npm run perf:bench -- 100` |
| 2026-07-11 | local | W-synth-1000 | 1000 | 0.807 | `npm run perf:bench -- 1000` (~590KB zip) |
| — | — | W2 real ZIP | — | — | pending real SIEG month |

## Guardrails already in code

- `IMPORT_LIMITS` (`src/lib/import/limits.ts`)  
- Web Worker import path (`runImportPipeline`)  
- Incremental hash skip + reuse lineage  

## Out of scope here

- Server-side cloud processing throughput (requires `FEATURE_CLOUD_PROCESSING` + Vercel env)  
- Network upload of full XML to Supabase Storage  
