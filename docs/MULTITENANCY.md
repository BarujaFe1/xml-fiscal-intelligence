# Multi-tenancy

## Model

- **Workspace** = tenant boundary (billing + membership).
- **Company / Establishment** = fiscal entities inside a workspace.
- Browser-sent `workspace_id` is **never** authorization — session + RLS decide.

## Code

- Roles/permissions: `src/lib/auth/permissions.ts`
- Request guards: `src/lib/auth/require-session.ts` (`privacy_local` when Supabase unset)
- Fiscal context UI (preference + URL): `FiscalContextSelector` — not a security boundary
- Migrations: `202607110001_saas_foundation.sql` (+ later)

## Live status

| Capability | Status |
| ---------- | ------ |
| Schema + RLS policies | Ready in migrations |
| Auth SSR clients | Ready |
| Membership-resolved roles in API | Deferred until Supabase keys |
| Cloud document store | Deferred (`FEATURE_CLOUD_PROCESSING`) |

See `AUTHORIZATION_MATRIX.md` and `RLS_TEST_MATRIX.md`.
