# XML Fiscal Intelligence

**Transforme lotes de XML fiscal em inteligência de dados.**

Envie um ZIP com NF-e, CT-e e NFS-e. O sistema lê as tags, cria planilhas, permite busca avançada e gera análises fiscais em minutos.

![stack](https://img.shields.io/badge/Next.js-16-black) ![ts](https://img.shields.io/badge/TypeScript-5-blue) ![license](https://img.shields.io/badge/privacy-fiscal%20first-emerald)

---

## Problema real

Fluxos com SIEG (e similares) terminam em ZIPs mensais por CNPJ. O trabalho manual — extrair, classificar tipos, abrir tags, lidar com múltiplos itens, buscar notas e consolidar — é lento e frágil.

## Solução

**XML Fiscal Intelligence** é um laboratório web de análise fiscal:

1. Upload seguro de ZIP  
2. Detecção automática NF-e / CT-e / NFS-e  
3. Flatten de **todas** as tags em colunas/paths  
4. Tabelas de documentos, itens e campos  
5. Busca global  
6. Detalhe completo da nota (tree + tags + JSON)  
7. Data Quality & Fiscal Insights (Health Score 0–100)  
8. Exportações Excel / CSV / JSON / HTML  

## Arquitetura (MVP)

**Opção A — full Next.js (escolhida para o MVP)**

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js App Router, TypeScript, Tailwind, Recharts |
| API | Route Handlers Node.js |
| Parser | `fast-xml-parser` (XXE mitigado: `processEntities: false`) |
| ZIP | `jszip` + validação zip-slip |
| Excel | `exceljs` |
| Persistência MVP | Filesystem `data/batches/*.json` (+ XML locais) |
| Schema futuro | Supabase Postgres + RLS (`supabase/schema.sql`) |
| Deploy | Vercel |

Evolução documentada: separar parser pesado em FastAPI (Render/Fly/Railway) via `PARSER_API_URL`.

## Health Score (0–100)

| Componente | Peso |
|------------|------|
| Validade XML | 20% |
| Campos essenciais | 20% |
| Duplicidades | 10% |
| Consistência de datas | 10% |
| Consistência de valores | 15% |
| Completude de itens | 15% |
| Identificação fiscal | 10% |

Fórmula implementada em `src/lib/quality/index.ts`.

## Como rodar local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) → **Analisar lote**.

### Testar com samples anonimizados

```bash
# Crie um ZIP a partir dos samples
cd samples/anonymized
# PowerShell:
Compress-Archive -Path *.xml -DestinationPath ..\..\private-test-data\samples.zip
```

Depois faça upload em `/app/upload`.

### Testar com seu ZIP real (SIEG)

1. Coloque o arquivo em `private-test-data/lote-xml.zip` (pasta **gitignored**)  
2. Faça upload pela UI  
3. **Nunca** commit XMLs reais  

### Anonimizar XML

```bash
npx tsx scripts/anonymize-xml.ts entrada.xml samples/anonymized/saida.xml
```

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Funcionalidades

- Upload ZIP com progresso e relatório de processamento  
- Detecção NF-e / NFC-e, CT-e, NFS-e (ABRASF-like)  
- Flatten genérico de tags + tabelas normalizadas  
- Dashboard do lote + gráficos  
- Busca global (documentos / itens / campos)  
- Detalhe da nota: resumo, itens, tags, tree, JSON  
- Quality & Insights  
- Export Excel multi-aba, CSV, JSON, HTML  
- Histórico de lotes  
- Mascaramento de CNPJ/CPF  

## Tipos de XML

- **NF-e / NFC-e** — `nfeProc`, `det[]`, impostos, protocolo  
- **CT-e** — prestação, carga, `infDoc` vinculados  
- **NFS-e** — parser resiliente a variações municipais/ABRASF  

## Segurança e privacidade

- Sem integração SIEG / certificado / scraping  
- Zip slip bloqueado; extensões perigosas ignoradas  
- XMLs reais fora do Git (`.gitignore` forte)  
- Samples apenas anonimizados em `samples/anonymized`  
- Ver `docs/SECURITY_AND_PRIVACY.md`  

## Deploy

### Vercel

```bash
npx vercel
npx vercel --prod
```

### Supabase (opcional)

1. Crie projeto Supabase  
2. Rode `supabase/schema.sql`  
3. Preencha `.env` com URL/keys  
4. Migre o store filesystem → Postgres (roadmap)  

## Documentação

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)  
- [DATA_MODEL.md](docs/DATA_MODEL.md)  
- [PARSER_DESIGN.md](docs/PARSER_DESIGN.md)  
- [SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md)  
- [DEPLOYMENT.md](docs/DEPLOYMENT.md)  
- [ROADMAP.md](docs/ROADMAP.md)  
- [PORTFOLIO_CASE.md](docs/PORTFOLIO_CASE.md)  

## Limitações conhecidas (MVP)

- Persistência local (não multi-usuário ainda)  
- Auth Supabase schema-ready, UI em modo demo local  
- NFS-e varia por município — cobertura best-effort  
- Processamento síncrono no request (lotes muito grandes podem exigir backend separado)  
- Export “campos completos” limita colunas dinâmicas às top paths  

## Roadmap (resumo)

- Supabase Auth + RLS real  
- Fila assíncrona / FastAPI parser  
- Comparador mês a mês  
- Full-text search Postgres  
- Dicionário de dados automático  

## Case de portfólio

Narrativa completa em [docs/PORTFOLIO_CASE.md](docs/PORTFOLIO_CASE.md).

## Aviso

Este software **não** é consultoria fiscal nem garante conformidade tributária. É uma ferramenta de engenharia de dados sobre XML fiscal. Trate XMLs como dados sensíveis.

---

Feito para transformar o ZIP do mês em decisão — rápido, auditável e bonito.
