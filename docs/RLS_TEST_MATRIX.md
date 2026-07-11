# RLS Test Matrix

Execute against a dedicated Supabase project after `npm run db:apply`.

## Fixtures

| Actor | Workspace | Role |
| ----- | --------- | ---- |
| User A | WS1 | owner |
| User B | WS1 | viewer |
| User C | WS2 | admin |

## Cases

| # | Action | Actor | Target | Expected |
| - | ------ | ----- | ------ | -------- |
| 1 | SELECT documents | A | WS1 | allow |
| 2 | SELECT documents | A | WS2 | deny (0 rows) |
| 3 | SELECT documents | C | WS1 | deny |
| 4 | INSERT batch | B (viewer) | WS1 | deny |
| 5 | INSERT batch | A | WS1 | allow |
| 6 | Guess UUID of WS2 company via API | A | WS2 id | 404/403 |
| 7 | Storage path `workspace/WS2/...` signed as A | A | WS2 | deny |
| 8 | Export API with foreign batch id | B | WS2 | deny |
| 9 | Removed membership | ex-A | WS1 | deny |
| 10 | Service role only for admin jobs | — | — | never in browser |

## Status

`blocked_external` until Supabase project keys exist. Do not mark commercial multi-tenant ready without green rows above.
