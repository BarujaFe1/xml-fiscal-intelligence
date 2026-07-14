# Vercel env sync (Supabase)

Production currently reports `supabase: false` on `/api/health` until these are set on the
**barujafe1s-projects** team project `xml-fiscal-intelligence`.

## Why the agent could not finish this alone

- Cursor MCP is logged into team `barujafe1s-projects` (can list deployments).
- Local Vercel CLI token is on a **different** account/team (`baruja-fe`) and gets `403` on this project.
- Setting env vars requires a token (or dashboard login) for **barujafe1**.

## One-shot (recommended)

1. Create a token while logged as **barujafe1**: https://vercel.com/account/tokens  
2. From the repo root (with `.env.local` filled):

```powershell
$env:VERCEL_TOKEN = "vercel_xxxx"
npm run vercel:sync-env
```

3. Redeploy production (Git → Redeploy latest, or empty commit / dashboard Redeploy).
4. Confirm:

```powershell
(Invoke-RestMethod https://xml-fiscal-intelligence.vercel.app/api/health).supabase
# expect: True
```

## Variables synced by the script

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FEATURE_CLOUD_PROCESSING=true`
- `NEXT_PUBLIC_FEATURE_CLOUD_PROCESSING=true`
- `STORAGE_PROVIDER=supabase`
- `STORAGE_BUCKET_XML=xml-batches`

Dashboard: https://vercel.com/barujafe1s-projects/xml-fiscal-intelligence/settings/environment-variables
