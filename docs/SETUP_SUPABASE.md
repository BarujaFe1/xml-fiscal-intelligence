# Setup Supabase (manual unblock)

A criação automática do projeto falhou:

> organization members have reached their maximum limits for the number of active free projects (2 project limit)

## O que você precisa fazer (2 minutos)

1. Abra https://supabase.com/dashboard  
2. Pause ou delete **1** projeto free antigo que não use  
3. Avise no chat com “slot liberado” **ou** cole o Project Ref do projeto que quiser usar  

Depois disso eu aplico:

```bash
npm run db:apply   # requer DATABASE_URL
```

e preencho `.env.local` + env da Vercel com URL/anon key.

## Já preparado no repo

- `supabase/schema.sql` + `schema-enterprise.sql` + migrations `001`–`004` (inclui seed `official_sources`)
- `npm run db:apply`
- `npm run efd:sample` → TXT em `private-exports/` (gitignored)
