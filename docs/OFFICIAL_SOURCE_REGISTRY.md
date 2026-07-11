# Official Source Registry

Process for encoding fiscal rules. Blogs are never validation sources.

## Seeded rows (migration `202607110004_official_sources_seed.sql`)

| id | URL |
|----|-----|
| sped:portal | https://www.gov.br/sped/pt-br |
| sped:efd-icms-ipi:hub | https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi |
| rfb:sped-download | https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped |
| sped:efd-icms-ipi:2026-watch | placeholder until Guia Prático hash filled |
| sped:efd-icms-ipi:2027-watch | placeholder until 2027 guide confirmed |

## Checklist when downloading a guide

1. Download only from RFB/SPED official pages  
2. Record: title, version, publish date, effective from/to, layout version, PVA version  
3. Compute SHA-256 of the PDF/ZIP  
4. `UPDATE official_sources SET document_hash=..., version_label=..., last_verified_at=current_date`  
5. Only then bind `rule_set_versions` to that `source_id`

## Do not

- Scrape aggressively / bypass captcha  
- Treat Senior (or any) blog as a rule source  
- Overwrite historical rule sets
