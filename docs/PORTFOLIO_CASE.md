# Portfolio Case — XML Fiscal Intelligence

## Problem

Analistas fiscais e times operacionais recebem ZIPs mensais de XML (NF-e/CT-e/NFS-e). Transformar isso em dataset pesquisável, exportável e auditável ainda é trabalho manual e frágil.

## Motivation

Construir uma **superfície de produto realista** (lab/MVP): parser resiliente, ETL no browser, analytics operacional e obrigações assistidas — com privacidade e sem claims jurídicos falsos.

## Architecture

Next.js full-stack com BatchStore tipado em IndexedDB; schema Supabase preparado; plugins de obrigações determinísticos (sem IA inventando imposto).

## Parser

- Detecção por estrutura (inclui namespaces prefixados)  
- Flatten genérico de tags  
- Extractors por família (NF-e, CT-e, NFS-e)  
- Itens multi-`det`  
- Fixtures sintéticas em `tests/fixtures/synthetic/`  

## Challenges

- Variância municipal de NFS-e  
- Export usável com cardinalidade alta de tags  
- ZIP/XML maliciosos  
- Não vazar dados fiscais reais no repositório público  

## Trade-offs

| Choice | Why | Cost |
|--------|-----|------|
| Parse no browser | Evita limite de body Vercel | SoT local por usuário |
| IndexedDB | Demo sem cloud | Não é multi-user completo |
| EFD assistido | Estudo/PVA import | Não é arquivo oficial |
| NFS-e best-effort | Cobertura sem falsa certeza | Municípios edge precisam adaptadores |

## Screenshots

Ver [`docs/SCREENSHOTS.md`](SCREENSHOTS.md).

## Interview narrative

Ver [`docs/DEMO_WALKTHROUGH.md`](DEMO_WALKTHROUGH.md) e [`docs/PORTFOLIO_HANDOFF.md`](PORTFOLIO_HANDOFF.md).
