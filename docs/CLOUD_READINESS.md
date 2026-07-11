# Cloud Readiness Gate

Cloud features must not appear “live” solely because env vars exist.

## Checks (server)

Implemented in `/api/ready` and `/api/health`:

| Check | Meaning |
| ----- | ------- |
| `supabaseConfigured` | URL + anon key present |
| `cloudProcessing` | `FEATURE_CLOUD_PROCESSING=true` |
| `billingLive` | Stripe gate (`BILLING_PROVIDER` + keys + ready flag) |
| `commercialReady` | supabaseConfigured ∧ billingLive |

## Required for SaaS mode

1. Supabase URL, anon, service role, DATABASE_URL  
2. Migrations applied (incl. RLS)  
3. Auth redirect URLs  
4. `FEATURE_CLOUD_PROCESSING=true`  
5. Optional: Stripe for paid plans  

If gate fails: IndexedDB remains source of truth; migrate API returns 503 with clear code.
