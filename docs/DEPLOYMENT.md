# Deployment

## Prerequisites

- Node 20+
- GitHub CLI (`gh`) authenticated
- Vercel CLI (`vercel`) authenticated

## GitHub

```bash
git add .
git commit -m "feat: initial XML Fiscal Intelligence app"
gh repo create xml-fiscal-intelligence --public --source=. --remote=origin --push
```

## Vercel

```bash
vercel
vercel --prod
```

Set env vars from `.env.example` in the Vercel project (optional for filesystem MVP).

## Supabase (optional)

1. Create project  
2. Run `supabase/schema.sql`  
3. Create storage bucket `xml-batches`  
4. Wire client later (roadmap)  

## Backend split (optional)

Deploy FastAPI to Render/Fly/Railway and set:

```
PARSER_API_URL=https://your-parser.example.com
```

## Limits

Serverless body size / duration may constrain very large monthly ZIPs. Raise `MAX_UPLOAD_MB` carefully or move processing off-request.
