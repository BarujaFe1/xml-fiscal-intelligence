# Retention Policy (draft)

**Status:** Engineering draft — subject to legal review.  
**Date:** 2026-07-11

## Defaults by artifact

| Artifact | Default retention | Notes |
| -------- | ----------------- | ----- |
| Raw XML | Plan-based (trial 90d → enterprise custom) | Cloud only when uploaded |
| Structured documents | Same as XML or longer if obligation open | |
| Exports | 30–180 days by plan | User may download earlier |
| Audit logs | 12 months minimum (ops) | No raw XML in logs |
| Billing events | Per Stripe + local copy 24 months | |
| PVA validation runs | 5 years suggested (fiscal cycle) | User-supplied reports |
| Local IndexedDB | Until user clears browser / migrates | Not a backup strategy |
| Local `rawXml` store (IDB v2) | Same lifetime as batch; deleted with batch | Original XML text only; never reconstructed |

## Deletion flows (target)

1. User requests workspace deletion → soft-delete + grace period (14–30 days).  
2. Cancel within grace → restore.  
3. After grace → purge storage paths + DB rows + revoke memberships.  
4. Legal hold flag blocks purge.

## Current implementation status

- Local mode: user can delete batch from IndexedDB UI/API; cascade removes `rawXml` rows for that batch.  
- Cloud purge automation: **not live** until Supabase project + jobs exist.  
- Backup/restore tested procedure: see `BACKUP_AND_RESTORE.md`.
- IndexedDB schema: v1 batches → v2 adds `rawXml` object store (compatible upgrade; old batches lack originals until reimport).
