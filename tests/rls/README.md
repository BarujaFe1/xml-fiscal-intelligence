# Real Postgres RLS Behavioral Test Suite

Live, two-tenant Row Level Security proof for the multi-tenant tables defined in
`docs/RLS_TEST_MATRIX.md`. Implemented as `tests/rls/real-rls.test.ts`, driven by
`vitest.rls.config.ts` (independent from the unit config in `vitest.config.ts`).

> **This suite is SKIPPED by default.** It only executes when explicitly enabled
> with a **test-only** database connection. It never touches production.

## Status in THIS environment

`blocked_external` — there is no local Postgres / `pg` CLI available here, and the
only `DATABASE_URL` present points at the **production Supabase cloud DB**, which
must not be used for destructive tests. The suite therefore ships skipped and
green (`npm run test:rls` passes with 0 failures). To get green *rows* you must
run it against a dedicated non-production database (below).

## How to run for real

1. **Provision a SEPARATE (non-production) Postgres/Supabase project.** Do not
   reuse the production project. The suite applies `supabase/schema.sql`,
   `supabase/schema-enterprise.sql`, and all `supabase/migrations/*.sql`, then
   seeds fixtures — it is destructive to that database.
2. Get its connection string (e.g. the Supabase *transaction* pooler URI, with
   the `postgres` role, or a direct connection string).
3. Set the guard env vars and run:

   ```bash
   # bash / powershell
   export RUN_RLS_LIVE=1
   export DATABASE_URL_TEST="postgresql://postgres:****@<your-test-host>:5432/postgres"
   npm run test:rls
   # (npm run test:db is an alias for the same live RLS proof)
   ```

   On Windows PowerShell:

   ```powershell
   $env:RUN_RLS_LIVE="1"
   $env:DATABASE_URL_TEST="postgresql://postgres:****@<your-test-host>:5432/postgres"
   npm run test:rls
   ```

## Hard guards (safety)

- The suite is gated by `describe.skipIf(!enabled)`. `enabled` is true only when
  **both** `RUN_RLS_LIVE === "1"` **and** `DATABASE_URL_TEST` is set.
- It reads **only** `process.env.DATABASE_URL_TEST`. It deliberately does **not**
  fall back to the production `DATABASE_URL`.
- If `DATABASE_URL_TEST` contains the production host
  (`uaqydwvdmwrwlvznoztd.supabase.co`) the suite **refuses** to run, prints a
  clear refusal message, and skips.

## What it verifies

Fixtures (all generated UUIDs, seeded in `beforeAll`, cleaned up in `afterAll`):

| Actor | Workspace | Role  |
| ----- | --------- | ----- |
| A     | WS1       | owner |
| B     | WS1       | viewer|
| C     | WS2       | admin |

Behavioral cases (auth simulated exactly like Supabase:
`SET LOCAL ROLE authenticated` + `SET LOCAL "request.jwt.claims" = '{sub,...}'`,
so `auth.uid()` resolves inside RLS policies):

| Case | Actor | Operation        | Target | Expected            |
| ---- | ----- | ---------------- | ------ | ------------------- |
| a    | A     | SELECT batches   | WS1    | allow (>0 rows)     |
| b    | C     | SELECT batches   | WS1    | deny (0 rows)       |
| c    | anon  | SELECT batches   | WS1    | deny (0 rows)       |
| d    | C     | INSERT batch     | WS1    | deny (throws)       |
| e    | A     | UPDATE/DELETE    | WS2 row| deny (0 affected)   |
| f    | A     | Storage WS2 path | WS2    | deny (bucket private; storage.objects RLS is WS-scoped) |

A per-case result table is printed in `afterAll`.

## Scope

The project enables RLS on **80 tables** (see `tests/unit/rls-hygiene.test.ts`).
This live suite covers the core multi-tenant tables referenced by
`docs/RLS_TEST_MATRIX.md` and the `is_workspace_member(workspace_id)` policy
pattern: `workspaces`, `batches`, `documents`, `exports`, `workspace_members`,
plus the `xml-batches` storage bucket privacy check. Extend the seed + cases to
cover additional tenant tables as needed.

## Offline companion

`tests/unit/rls-hygiene.test.ts` (run by `npm test`) statically greps the
migration files for RLS hygiene and stays green without any database.
