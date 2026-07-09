# Security and Privacy (fiscal)

## Disclaimer

Este sistema auxilia análise, organização, auditoria e diagnóstico fiscal, mas **não substitui** validação contábil/fiscal profissional, legislação aplicável, consultoria tributária, nem o PVA/SPED oficial.

Validação de assinatura digital, quando disponível, é **técnica** e não garante validade jurídica absoluta.

## Threat model

- ZIP malicioso (zip slip, bombas, executáveis)
- XML malicioso (XXE, entity expansion)
- Vazamento acidental de XMLs/PDFs/certificados reais para GitHub
- Envio indevido de dados fiscais a providers de IA externos
- Scraping / automação indevida de SEFAZ ou serviços públicos

## Controls

| Risk | Control |
|------|---------|
| Zip slip | Reject `..` and absolute paths |
| Executables in ZIP | Extension denylist |
| XXE | `processEntities: false` |
| Real data in git | `.gitignore` for `data/`, `private-*`, `*.zip`, `*.pfx` |
| UI exposure | CNPJ/CPF masking toggle |
| Secrets | `.env.example` only; no keys committed |
| AI | `ENABLE_AI=false` + mock; `ENABLE_DATA_MASKING=true` |
| SEFAZ | Only official channels with user credentials — no scraping |

## Local private folders (gitignored)

| Path | Purpose |
|------|---------|
| `private-data/` | dumps / analytics local |
| `private-imports/` | ZIPs reais de importação |
| `private-exports/` | exports gerados |
| `private-certificates/` | certificados do usuário |
| `private-test-data/` | smoke tests locais |

Only `README.md` placeholders are tracked inside these folders.

## Rules for contributors

1. Never commit real XMLs, PDFs fiscais, ZIPs from SIEG, or certificates  
2. Prefer `scripts/anonymize-xml.ts` before sharing samples  
3. Do not send fiscal payloads to third-party AI/APIs without explicit consent  
4. Demo mode should mask CNPJ, CPF, IE and access keys when enabled  

## Demo vs real

- `ENABLE_DEMO_MODE` / `ENABLE_MASKING` / `ENABLE_DATA_MASKING` in env  
- Settings page stores local masking preference  
- Samples only under `samples/anonymized`

## LGPD notes

Fiscal XML often contains personal and business identifiers. Treat batches as sensitive personal/business data: minimize retention, restrict access, document processing purpose, and avoid unnecessary cloud sync of raw XML.
