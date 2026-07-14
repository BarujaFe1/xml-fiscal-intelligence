# Plano detalhado — Fase 4: ECD (motor contábil)

**Status pós-implementação:** feito em `feat/accounting-engine-ecd` — maturidade ECD `development`. Gates: `tsc` + 167 testes.  
**Pré-requisito:** Fase 3 Reinf em estado estável (ou empilhada) + autorização para iniciar.  
**Branch:** `feat/accounting-engine-ecd`  
**Sem** push/deploy sem autorização. **ECF (Fase 5)** → [`PHASE_5_ECF_PLAN.md`](PHASE_5_ECF_PLAN.md).

## Objetivo

Substituir o esqueleto DEMO por um **motor contábil real**: plano de contas com vigência, lançamentos em partidas dobradas, livros (Diário/Razão/balancetes), importadores CSV/XLSX/JSON, cockpit de fechamento contábil, e plugin ECD gerando TXT a partir do ledger (não de NF-e).

## Maturidade alvo

| Marco | Maturidade |
|-------|------------|
| Modelo plano + lançamentos + equilíbrio + IDB | ~~`development`~~ **atingido** |
| Importadores + Diário/Razão + plugin ECD sem DEMO obrigatório | `internal_beta` (próximo, com evidência operacional) |
| 1º TXT aceito no Programa ECD (evidência) | `official_validator_beta` (cenário) |
| `validated_scope` / `production` | fora da Fase 4 inicial |

## Escopo (checklist)

### 4.1 Modelo de dados

- [x] `ChartAccount`: código, nome, nível, natureza, sintética/analítica, vigência, conta referencial, centro de custo opcional
- [x] `JournalEntry` / `JournalLine`: lote, data, débito/crédito, valor, histórico, documento, participante, origem, usuário
- [x] Regras: partidas dobradas, equilíbrio do lote, conta ativa, período aberto
- [x] Imutabilidade após aprovação (status + snapshot hash)

### 4.2 Persistência

- [x] IndexedDB `xfi_ledger_v1` (local-first)
- [x] Migration Supabase: `chart_accounts`, `journal_entries`, `journal_lines`, RLS
- [x] Vincular evidências/exports ao storage privado

### 4.3 Importadores (início do framework ERP)

- [x] CSV/JSON: plano, saldos iniciais, lançamentos
- [x] Template + mapeamento + preview + erros + idempotency key
- [x] Doc `ERP_CONNECTOR_FRAMEWORK.md` (genérico; sem TOTVS/SAP específicos ainda)
- [x] Import ECD anterior (TXT → canônico com lineage de linha)

### 4.4 Livros e demonstrações

- [x] Diário, Razão, balancetes diários/mensais
- [x] BP e DRE básicos a partir do ledger (metodologia documentada)
- [x] UI drill-down razão → lançamento → origem

### 4.5 Cockpit contábil

- [x] Extensão `/app/ledger` — pendências, desequilíbrios, contas sem movimento, saldos invertidos
- [x] Checklist aprovação preparador/revisor (SoD básico)

### 4.6 Plugin ECD

- [x] `detectRequiredData` bloqueia modo oficial se ledger DEMO
- [x] build I050/I200/… a partir do ledger real
- [x] Manter caminho DEMO explícito (`extras.ecdMode=demo`)
- [x] Integração lab. Programa ECD (`homologationGrade` como PVA)

### 4.7 Testes e docs

- [x] Fixture ledger sintético → TXT ECD → validação L1
- [x] Unit equilíbrio / período / imutabilidade
- [x] Atualizar `ACCOUNTING_ENGINE.md`, `ECD_PROFESSIONAL_SCOPE.md`, matriz maturidade
- [x] Relatório §28 / plano Fase 5

## Critérios de saída

- [x] Maturidade ≥ `development`
- [x] Plugin ECD gera TXT sem contas DEMO no modo oficial
- [x] Zero geração de I200 a partir de NF-e
- [x] Doc engine saiu de “planned”
- [x] Fase 5 pronta para kickoff (`PHASE_5_ECF_PLAN.md`)

## Kickoff original

Comando: **“aplique Fase 4”** — concluído.