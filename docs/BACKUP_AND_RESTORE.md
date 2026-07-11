# Backup and Restore

**Date:** 2026-07-11  
**Status:** Strategy documented; automated cloud restore **not verified in production** until Supabase is live.

## Current layers

| Layer | Mechanism | Restorable? |
| ----- | --------- | ----------- |
| Local IndexedDB | Browser storage | Only on same profile/device |
| Repo migrations | `supabase/migrations/` | Schema only |
| Private storage folder | `LOCAL_STORAGE_ROOT` | Manual copy |
| Supabase | PITR / dumps (when project exists) | Yes — after configure |

## Engineer checklist (when Supabase is available)

1. Enable PITR or schedule `pg_dump`.  
2. Backup storage buckets (XML/exports) with same retention as DB.  
3. Quarterly restore drill into a branch DB.  
4. Record drill date in `OPERATIONS_RUNBOOK.md`.  

**Rule:** Untested backup is not a recovery strategy.

## Local disaster recovery

- Export JSON/XLSX regularly from the app.  
- Use migrate wizard to register metadata when cloud is ready.  
- Do not rely on IndexedDB as sole archive for obligations.
