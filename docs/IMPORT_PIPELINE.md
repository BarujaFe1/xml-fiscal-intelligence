# Import Pipeline

## Browser path (production-safe on Vercel)

1. `/app/upload` reads ZIP via `File.arrayBuffer()`  
2. `processZipBatchInMemory` extracts + parses  
3. Optional **incremental** skip via `idbCollectKnownHashes()`  
4. Audit + relationships  
5. `idbSaveBatchStore`  

## Duplicate detection

| Layer | Signal |
|-------|--------|
| Incremental | SHA-256 already in prior batches |
| In-batch | Same `xmlHash` |
| In-batch | Same `accessKey` |

## Logs

`BatchStore.importLogs[]` with steps: `start`, `extract`, `incremental_skip`, `parse`, `audit`, `relationships`, `done`.

## Limits

- Prefer local `npm run dev` for very large ZIPs  
- Vercel request body limit avoided by client-side parse  
- RAR/7z adapters: not implemented — document fallback to ZIP  
