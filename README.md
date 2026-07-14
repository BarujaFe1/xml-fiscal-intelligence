# README — XML Fiscal Intelligence

**Lab analítico full-stack:** importar ZIPs de XML fiscal (NF-e, NFC-e, CT-e, NFS-e), normalizar tags/itens, buscar, auditar heurísticamente e exportar planilhas — com privacidade e limites legais explícitos.

![stack](https://img.shields.io/badge/Next.js-16-black) ![ts](https://img.shields.io/badge/TypeScript-5-blue) ![tests](https://img.shields.io/badge/vitest-121-green)

> **Não é PVA/SPED oficial**, não é parecer contábil e não substitui validação profissional. Geração EFD é **rascunho assistido** para importação/estudo no PVA.

---

## Problema

Lotes mensais (ZIP) de XML exigem extrair, classificar, buscar tags, consolidar itens e checar inconsistências — fluxo lento e fácil de errar à mão.

## Solução (fluxo demonstrável)

1. Upload de ZIP no navegador (parse client-side — evita limite de body da Vercel)  
2. Detecção de família documental + flatten de tags + explosão de itens  
3. Deduplicação por SHA-256 / chave; importação incremental  
4. Busca, filtros, quality score, export Excel/CSV/JSON  
5. Auditoria heurística + relações NF-e↔CT-e  
6. Obrigacões assistidas (EFD ICMS/IPI e outras) — **pré-validação interna**, não transmissão  

## O que este projeto demonstra (portfólio)

| Área | Evidência no repo |
|------|-------------------|
| Parsing XML fiscal + namespaces | `src/lib/parser/*`, fixtures em `tests/fixtures/synthetic/` |
| ETL no browser (ZIP → store tipado) | `src/lib/store/*`, IndexedDB |
| Analytics operacional | dashboards, quality score, exports |
| Domínio fiscal com honestidade | banners EFD/PVA, `docs/KNOWN_LIMITATIONS.md` |
| Testes | Vitest (parser, EFD, zip, security corpus) |

## Stack real

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind · fast-xml-parser · JSZip · ExcelJS · IndexedDB · Vitest · (opcional) Supabase schema/RLS · deploy Vercel.

## Arquitetura (visão)

```
ZIP → parser (detect/flatten/extract) → BatchStore (IndexedDB)
                                         ├─ busca / filtros / export
                                         ├─ audit heurística
                                         └─ plugins de obrigações (EFD draft)
```

Fonte de verdade de lote grande: **IndexedDB do navegador**. Postgres/Supabase: schema e metadados parciais — não é sync completo de XML bruto.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) → **Upload**.

### Samples anonimizados (sem PII real)

```powershell
Compress-Archive -Path samples\anonymized\*.xml -DestinationPath private-imports\samples.zip -Force
```

Roteiro de demo 3–5 min: [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md).

## Gates

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Privacidade e limites legais

- Pastas `private-*` gitignored — **nunca** commitar XML/ZIP/certificado real  
- XXE: `processEntities: false`; Zip Slip e denylist de executáveis no import  
- Sem assistente de IA no produto (removido)  
- Detalhes: [`docs/SECURITY_AND_PRIVACY.md`](docs/SECURITY_AND_PRIVACY.md), [`docs/LGPD_DATA_MAP.md`](docs/LGPD_DATA_MAP.md)

## Deploy público

https://xml-fiscal-intelligence.vercel.app  

Em produção, lotes grandes permanecem no **IndexedDB do usuário**. Reimporte o ZIP após limpar o storage do site se necessário.

## Limitações honestas

- NFS-e municipal: **best-effort** (schemas variam)  
- EFD: rascunho assistido — conferir no PVA; não inventamos COD_REC/IE  
- XSD/assinatura: stubs técnicos, não validade jurídica  
- Multi-tenant cloud de XML bruto: parcial  
- Lista viva: [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md)

## Documentação útil

| Doc | Uso |
|-----|-----|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Visão de módulos |
| [PARSER_CAPABILITY_MATRIX.md](docs/PARSER_CAPABILITY_MATRIX.md) | O que o parser afirma |
| [PORTFOLIO_HANDOFF.md](docs/PORTFOLIO_HANDOFF.md) | Before/after e entrevista |
| [DEMO_WALKTHROUGH.md](docs/DEMO_WALKTHROUGH.md) | Demo guiada |
| [CHANGELOG.md](docs/CHANGELOG.md) | Histórico |

## Roteiro rápido de entrevista

1. Problema do ZIP mensal → BatchStore tipado  
2. Namespaces / NFC-e / eventos (fixtures sintéticas)  
3. Trade-off IndexedDB vs API body limits  
4. Por que EFD não é “SPED válido”  
5. Controles de privacidade e o que *não* está no escopo  

---

Feito para transformar o ZIP do mês em dataset pesquisável e auditável — com limites explícitos.
