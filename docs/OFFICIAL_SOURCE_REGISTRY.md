# Official Source Registry

Governance index for normative and technical sources used by XML Fiscal Intelligence.

## Principles

1. Official government sources beat blogs.
2. Every rule version records organ, URL, publication, vigência, jurisdiction, hash, consultation date.
3. “Current version” is never a permanent constant — resolve by competence.
4. Do not scrape aggressively; do not invent public APIs.

## Seeded / tracked sources

| ID | Organ | Name | URL | Status |
| -- | ----- | ---- | --- | ------ |
| sped-portal | RFB/SPED | Portal SPED | https://www.gov.br/sped/pt-br | active |
| efd-icms-ipi | RFB/SPED | EFD ICMS/IPI | https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi | active |
| cnpj-alpha | RFB | CNPJ alfanumérico | https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico | active |
| cnpj-dv-manual | RFB | Manual DV CNPJ | https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf | active |
| rtc-consumo | RFB | Reforma Tributária do Consumo | https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo | monitoring |
| nfe-portal | SEFAZ | Portal NF-e | https://www.nfe.fazenda.gov.br/portal/principal.aspx | active |
| owasp-asvs | OWASP | ASVS | https://owasp.org/www-project-application-security-verification-standard/ | reference |
| wcag22 | W3C | WCAG 2.2 | https://www.w3.org/TR/WCAG22/ | reference |

## Database tables

See migrations `202607110004_official_sources_seed.sql` and `202607110005_regulatory_governance.sql` for:

- `official_sources`
- `official_source_versions`
- `fiscal_rule_sets` / `fiscal_rule_versions`
- `official_table_versions`
- `schema_catalog` / `schema_versions`
- `regulatory_updates`

## Consultation log (this hardening pass)

| Date | Source | Notes |
| ---- | ------ | ----- |
| 2026-07-11 | Manual DV CNPJ | Implemented ASCII−48 mod11 in `src/lib/fiscal/cnpj.ts` |
| 2026-07-11 | RTC portal | Documented readiness; no invented tax mapping |
