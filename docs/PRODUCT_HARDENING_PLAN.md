# Product Hardening Plan — XML Fiscal Intelligence

**Baseline HEAD (start):** `8410f7a`  
**Current:** deploy `dpl_CMTpYzUuj5yL2o98vvDEKorZQnKR` → https://xml-fiscal-intelligence-phi.vercel.app  
**Supabase project:** `uaqydwvdmwrwlvznoztd`

## Status

### Phase 0 — Baseline — [x]
### Phase 1 — Security P0
- [x] API tenancy + auth guards
- [x] Migration SQL authored (`202607220001_fix_workspace_members_insert.sql`)
- [x] Live BOLA probe: **VULNERABLE before fix** (self-join succeeded as user B → workspace A)
- [ ] Migration **applied on remote** — needs Database password / SQL Editor Run (Management API/MCP lack project ownership; REST keys cannot run DDL)
- [ ] Re-verify BOLA blocked after apply

### Phase 2 — Export P0 — [x]
### Phase 3 — Persistence
- [x] `.env.local` configured (gitignored)
- [x] Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FEATURE_CLOUD_PROCESSING` (Production/Preview/Development)
- [~] Cloud migrate routes require auth + membership
- [ ] RLS live suite against dedicated test DB (prod host is guarded by design)

### Phase 4 — Nav / language — [x] core / [~] full PT sweep
### Phase 5–6
- [x] typecheck / unit / build / deploy
- [~] lint debt
- [ ] E2E fixture browser with auth session

## Evidence — BOLA probe (pre-fix)

```
BOLA self-join attempt VULNERABLE: insert succeeded
```

Script: `scripts/supabase-rls-probe.ts`

## Apply migration (manual one-click)

1. SQL Editor opened: https://supabase.com/dashboard/project/uaqydwvdmwrwlvznoztd/sql/new  
2. SQL is in `supabase/migrations/202607220001_fix_workspace_members_insert.sql` (also copied to clipboard when script ran)  
3. Click **Run**  
4. Then: `npx tsx scripts/supabase-rls-probe.ts` → expect `BLOCKED`

Or provide URI: `postgresql://postgres.[ref]:[DB-PASSWORD]@...` and run:
`node scripts/apply-membership-migration.mjs "<URI>"`

## Security note

API/service keys were shared in chat — **rotate** `service_role` / secret after this session. Never commit `.env.local`.
