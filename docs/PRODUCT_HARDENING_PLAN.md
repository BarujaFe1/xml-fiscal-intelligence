# Product Hardening Plan — XML Fiscal Intelligence

**Baseline HEAD (start):** `8410f7a` (21/07/2026)  
**Fixture:** `...\drive-download-20260722T005900Z-1-001\202606 NFe.zip` (not in Git)  
**Public app:** https://xml-fiscal-intelligence-phi.vercel.app  

## Status

### Phase 0 — Baseline
- [x] HEAD / worktree recorded
- [x] Fixture located
- [x] XLSX corruption characterized (`addTable` + `rows: []`)
- [x] Fixture inventory script + metrics (see Evidence)

### Phase 1 — Security P0
- [x] `requireApiSession` + tenant-scoped fs-store (`ownerKey`)
- [x] Lock batches / export / import / search / storage/local
- [x] migrate / snapshot / companies/sync require auth + membership
- [x] Migration `202607220001_fix_workspace_members_insert.sql` (self-join blocked)
- [ ] RLS live tests against real Supabase project — **blocked externally until migrations applied**

### Phase 2 — Export integrity P0
- [x] Removed ExcelJS empty-table corruption (autoFilter)
- [x] Structural XLSX tests (`export-hardening-p0.test.ts`)
- [x] Multilote selection via `resolveSelectionAcrossStores` + wizard
- [~] ZIP/CSV/JSON/HTML already covered by prior unit suite

### Phase 3 — Persistence
- [~] Auth SSR existing; cloud migrate gated
- [ ] Remote migrations applied — **external**
- [~] Ready endpoint: local gates green; cloud depends on env

### Phase 4 — IA / language / nav
- [x] Main nav reduced to 8 items
- [x] Batch Documentos uses single DocumentExportWorkspace (legacy fork removed)
- [x] CBS/IBS presence filters restored
- [x] `src/lib/ui/format.ts` for dates/money/entities
- [~] Full PT-BR sweep / badge translation remaining

### Phase 5–6
- [x] typecheck / unit tests / build
- [~] lint (pre-existing debt remains)
- [ ] full E2E fixture in browser with auth
- [ ] deploy smoke

## Decisions

| Date | Decision |
| --- | --- |
| 2026-07-21 | ExcelJS: autoFilter instead of structured tables with empty `rows` (issue 2678). |
| 2026-07-21 | Selection: `batchId:documentId`; exports resolve across all stores. |
| 2026-07-21 | Server fs-store scoped by authenticated user id; prod without Supabase rejects shared APIs. |
| 2026-07-21 | Membership insert only via owner/admin or valid invite (no self-join). |

## Evidence — fixture 202606 NFe.zip

```json
{
  "documents": 1155,
  "model55": 1155,
  "cClassTribDocs": 782,
  "cbsTotDocs": 670,
  "ibsTotDocs": 670,
  "dupDocs": 429,
  "selectablePaths": 8768
}
```

Notes:
- `selectablePaths` counts **all** flattened keys (incl. indexed item paths). Curated catalog seed remains **518** human-selectable fields — not a silent loss.
- `dupDocs` 429 vs audit 458: path matcher uses `dup.vDup` / `cobr.dup.vDup`; residual gap documented for follow-up, not adjusted to fake green.

## Gates (local)

| Gate | Result |
| --- | --- |
| typecheck | pass |
| unit tests | 314 pass / 2 skip |
| build | pass |
| RLS remote | blocked — apply migration |
