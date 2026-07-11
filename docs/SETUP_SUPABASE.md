# Setup Supabase

**Projeto live:** `xml-fiscal-intelligence`  
**Ref:** `uaqydwvdmwrwlvznoztd`  
**Org:** BarujaFe's 01 (`sjcktlyolwwbumgoktza`)  
**Region:** `sa-east-1`  
**URL:** https://uaqydwvdmwrwlvznoztd.supabase.co  

## Applied migrations (MCP + repo)

`schema_core` → `schema_enterprise` → `saas_foundation` → `jobs_obligations` → `billing_entitlements_v2` → `official_sources_seed` → `regulatory_governance` → **`rls_remaining` (006)** → **`plan_seeds_and_profile_trigger` (007)** → **`security_advisor_fixes` (008)**

## `.env.local` (gitignored)

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / publishable
- `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL`
- `FEATURE_CLOUD_PROCESSING=true` + `NEXT_PUBLIC_FEATURE_CLOUD_PROCESSING=true`

## Auth URL config (Dashboard)

Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs:  
  `http://localhost:3000/auth/callback`  
  `https://xml-fiscal-intelligence.vercel.app/auth/callback`

Also enable **Leaked password protection** when ready:  
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Scripts

```bash
npm run db:apply   # reaplicar via DATABASE_URL (idempotent-ish)
```
