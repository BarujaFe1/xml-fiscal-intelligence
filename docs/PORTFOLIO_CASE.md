# Portfolio Case — XML Fiscal Intelligence

## Problem

Accountants and fiscal analysts download monthly XML batches (often via SIEG certificate vaults). Turning those ZIPs into searchable, exportable, quality-checked datasets is still mostly manual.

## Motivation

Build a **real product surface**: not a toy parser demo, but a premium analysis lab that respects Brazilian fiscal XML diversity and privacy constraints.

## Architecture

Full-stack Next.js MVP with a clean seam to Supabase + optional FastAPI. Local filesystem store proves the UX end-to-end without blocking on cloud credentials.

## Parser

- Family detection by structure
- Generic flatten (every tag → path)
- Friendly extractors per document type
- Item explosion for multi-`det` NF-e
- Linked documents for CT-e
- Resilient NFSe service extraction

## Challenges

- NFSe schema fragmentation across municipalities
- Keeping exports usable when tag cardinality explodes
- Safe ZIP handling
- Not leaking real fiscal data in a public repo

## Trade-offs

| Choice | Why | Cost |
|--------|-----|------|
| Next-only MVP | Ship + deploy fast | Large batches may need worker later |
| Filesystem store | Zero cloud setup | Not multi-user yet |
| Top-N dynamic Excel columns | Practical sheets | Not literally infinite columns |
| Best-effort NFSe | Coverage without false certainty | Edge municipalities need adapters |

## Screenshots

Run locally and capture:

1. Landing  
2. Upload  
3. Batch dashboard  
4. Document detail / tree  
5. Quality insights  
6. Excel export  

## Next steps

Wire Supabase, async processing, and month-over-month comparison to turn the MVP into a SaaS.
