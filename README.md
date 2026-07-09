# README — XML Fiscal Intelligence

**Plataforma fiscal/data product para importar, processar, pesquisar, auditar e exportar lotes de XML (NF-e, CT-e, NFS-e).**

![stack](https://img.shields.io/badge/Next.js-16-black) ![ts](https://img.shields.io/badge/TypeScript-5-blue) ![privacy](https://img.shields.io/badge/privacy-fiscal%20first-emerald)

> Este sistema auxilia análise, organização, auditoria e diagnóstico fiscal, mas **não substitui** validação contábil/fiscal profissional, legislação aplicável, consultoria tributária, nem o PVA/SPED oficial.

---

## Problema

ZIPs mensais (SIEG e similares) exigem extrair, classificar, buscar tags, consolidar itens e auditar inconsistências — trabalho lento e frágil.

## Solução

1. Upload seguro de ZIP (parse no navegador — sem limite de 4,5 MB da Vercel)  
2. Detecção NF-e / NFC-e / CT-e / NFS-e / eventos  
3. Flatten de tags + itens + classificação CFOP  
4. Importação **incremental** (SHA-256) e duplicidade por chave/hash  
5. Busca, dashboards, quality score  
6. Auditoria fiscal + relacionamentos NF-e↔CT-e  
7. SPED preview (diagnóstico) + IA mock segura  
8. Export Excel / CSV / JSON / HTML  

## Stack

Next.js App Router · TypeScript · Tailwind · Recharts · Zod-ready types · IndexedDB · Postgres schema (Supabase) · OpenAPI draft

## Como rodar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) → **Upload**.

### Samples anonimizados

```powershell
Compress-Archive -Path samples\anonymized\*.xml -DestinationPath private-imports\samples.zip
```

### ZIP real

Coloque em `private-imports/` ou `private-test-data/` (gitignored). **Nunca** committe XMLs reais.

## Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [ENTERPRISE_UPGRADE_PLAN.md](docs/ENTERPRISE_UPGRADE_PLAN.md) | Plano e fases |
| [HANDOFF.md](docs/HANDOFF.md) | O que foi entregue |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura |
| [SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md) | LGPD / privacidade |
| [IMPORT_PIPELINE.md](docs/IMPORT_PIPELINE.md) | Pipeline de import |
| [openapi.yaml](docs/openapi.yaml) | Contrato API |

## Segurança

- Sem scraping SEFAZ / automação indevida  
- Pastas `private-*` ignoradas  
- IA desligada por padrão (`ENABLE_AI=false`)  
- Assinatura/XSD: stubs documentados (sem promessa jurídica)  

## Deploy

```bash
npx vercel
```

Em produção, lotes ficam no **IndexedDB do navegador** (FS efêmero na Vercel).

## Limitações

- Persistência multi-usuário Postgres ainda schema-ready  
- SPED é preview/diagnóstico  
- DuckDB/Parquet e OCR: preparados na documentação  
- NFS-e municipal: best-effort  

## Portfólio

Narrativa em [docs/PORTFOLIO_CASE.md](docs/PORTFOLIO_CASE.md).

---

Feito para transformar o ZIP do mês em decisão — rápido, auditável e responsável.
