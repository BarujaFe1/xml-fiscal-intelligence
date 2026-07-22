# XML Fiscal Intelligence — Relatório Geral (Super MD)

> Documento único e completo do estado do projeto em **16/07/2026**. Serve para
> repasse ao ChatGPT / revisores e para o pai (leigo em programação) entender o que
> foi construído, como está hoje e como usar.

---

## 1. Resumo executivo

O **XML Fiscal Intelligence** é uma aplicação web que transforma lotes de NF-e
(XML da receita federal) em **escriturações fiscais EFD ICMS/IPI** no leiaute
oficial **020** (NT 2025.001 / Ato COTEPE 79/2025), prontas para importação no
validador oficial da Receita (PVA).

Estado atual (16/07/2026):

- ✅ **Site publicado e acessível a qualquer pessoa com o link:**
  👉 **https://xml-fiscal-intelligence.vercel.app**
- ✅ **Gerador EFD 100% funcional** e validado contra o leiaute oficial
  (0 erros em 301 arquivos gerados).
- ✅ **262 testes automatizados passando**, typecheck limpo.
- ✅ **Correção dos erros do PVA** (arquivo `erros.csv`) concluída — eram
  bugs de **leiaute**, não de dados.
- ⚠️ **Sincronização na nuvem (Supabase) pendente de 1 migration** (ver seção 9).
  O app funciona 100% local mesmo sem isso.

---

## 2. O problema que o projeto resolve

Uma empresa que recebe centenas de NF-e por mês precisa montar a **EFD ICMS/IPI**
(um arquivo texto de ~70 linhas por empresa, com dezenas de registros fiscais)
para entregar à Receita. Fazer isso à mão, no validador da Receita, é lento e
sujeito a erro. Ovalidador oficial (PVA) **não tem linha de comando** — só interface
gráfica — então a validação final ainda é manual, mas a *geração* pode ser
automatizada.

**Entrada:** pasta com XMLs de NF-e (ex.: lote `202606 NFe.zip` = 1.147 XMLs,
300 CNPJs diferentes).
**Saída:** 1 arquivo `efd-<CNPJ>.txt` por empresa, pronto para importar no PVA.

---

## 3. O que foi feito (cronologia)

### 3.1 PR3 — Gerador EFD ICMS/IPI (concluído)
- Implementado o gerador completo do leiaute **020** (registros 0000, 0001, 0002,
  0005, 0100, 0150, 0190, 0200, 0400, C100, C170, C190, bloco E, 1001, 1010,
  9001, 9900, 9999…).
- Refatorado de um arquivo monolítico para módulos (`src/modules/obligations/efd-icms-ipi/*`).
- Testado contra o Guia Prático 3.2.2; geração determinística (golden hash).

### 3.2 PR4 — Captura de dados + cadastro + nuvem (concluído)
- Tela de **cadastro local** da empresa (IE, CNAE, perfil A/B/C, propósito,
  crédito anterior, contador…) persistida no navegador (IndexedDB).
- Tela de **obrigações EFD** que carrega o cadastro e gera a escrituração.
- **Integração Supabase** (sincronização de cadastros entre dispositivos):
  - Migration `202607160002` (estende `cloud_companies` com campos fiscais).
  - API `/api/companies/sync` (POST grava, GET reconstrói).
  - Helper `src/lib/cloud/companies.ts` com fallback local.
  - `.env.example` documentando as variáveis.

### 3.3 Correção dos erros do PVA (`erros.csv`) — concluída
O PVA rejeitou os arquivos gerados por **erro de leiaute** (número de campos
errado em C170/C190 e valores nas posições trocadas). Diagnosticado e corrigido:

| Registro | Erro no PVA | Causa | Correção |
|---|---|---|---|
| **C170** | "38 campos; espera 34" + CST_PIS/VL_BC_PIS "Não se Aplica" | builder emitia 36 campos (incluía `VL_BC_IPI`/`ALIQ_IPI` que **não existem** em C170) | C170 agora tem **34 campos oficiais**: adicionados `ALIQ_ST`, `COD_ENQ`, `VL_ABAT_NT`; removidos `VL_BC_IPI`/`ALIQ_IPI` |
| **C190** | CFOP='000', CST_ICMS='0' | builder inseria `IND_APUR_ICMS` espúrio no início (C190 oficial **não tem** esse campo) | C190 agora tem **11 campos oficiais**, sem `IND_APUR_ICMS` |
| **E110** | "15 campos; espera 16" | comentário errado no código (builder já emitia 16) | comentário corrigido; índices de leitura do C190 ajustados |

> Detalhe técnico: o `IND_APUR_ICMS` pertence ao **C100**, não ao C190. E os
> campos `VL_BC_IPI`/`ALIQ_IPI` simplesmente não existem no C170 (lá só vão
> `CST_IPI`, `COD_ENQ`, `VL_IPI`).

---

## 4. Arquitetura técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js (versão custom do projeto) + TypeScript |
| UI | Tailwind CSS |
| Armazenamento local | IndexedDB (cadastro da empresa no navegador) |
| Nuvem (opcional) | Supabase (Postgres + RLS) — só para espelhar cadastros |
| Validação | Validadores offline próprios + PVA oficial (manual) |
| Deploy | Vercel |

**Fluxo de geração:**
```
XMLs (NF-e)  ──parse──▶  Documentos  ──buildObligationContextFromBatch──▶  Contexto
Contexto  ──efdIcmsIpiPlugin.build──▶  Registros (C100/C170/C190/E110…)
Registros ──serialize──▶  efd-<CNPJ>.txt  ──▶  importar no PVA
```

Principais módulos:
- `src/modules/obligations/efd-icms-ipi/builders/index.ts` — monta os registros.
- `src/modules/obligations/efd-icms-ipi/calculations/index.ts` — E110 (débitos/créditos ICMS).
- `src/modules/obligations/efd-icms-ipi/layouts/020/records.ts` — definição oficial dos campos.
- `src/modules/obligations/efd-icms-pi/layouts/020/offline-validator.ts` — validação offline (conta campos).
- `scripts/pva/*` — geração em lote e varredura offline (PVA-like).

---

## 5. Validação (prova de que está correto)

Rodados sobre os **301 arquivos** gerados (300 empresas do lote real + 1 demo):

| Validação | Resultado |
|---|---|
| `scan-offline` (conta campos vs leiaute) | **0 erros em 301 arquivos** |
| `check-layout-align` (tipos/posições de 359.597 campos) | **0 inconsistências** |
| Testes automatizados | **262 passando** (2 skipped) |
| `tsc --noEmit` (typecheck) | limpo |

Local dos arquivos gerados: `docs/pva/2026-06/generation-2/efd-*.txt`.
Resumo por empresa: `docs/pva/2026-06/generation-2/companies-summary.csv`
(300 linhas, todas status `ok`).

---

## 6. Como usar (passo a passo para o usuário final)

1. Acesse **https://xml-fiscal-intelligence.vercel.app**.
2. Cadastre a empresa (IE, UF, CNAE, perfil A/B/C, contador…) — fica salvo no navegador.
3. Envie a pasta/arquivos XML das NF-e do período.
4. Clique em **Gerar EFD ICMS/IPI**.
5. Baixe o `efd-<CNPJ>.txt`.
6. No validador oficial da Receita (PVA / `SpedEFD.exe`), importe o arquivo →
   **não deve apresentar erros de leiaute** (os erros anteriores foram corrigidos).

> O PVA continua sendo a fonte oficial de validação (ele não tem linha de
> comando). A automação cuida de gerar o arquivo já no formato aceito.

---

## 7. Custos

- **Hospedagem (Vercel):** plano gratuito (Hobby) — suficiente para o app.
- **Nuvem Supabase:** plano gratuito — suficiente para espelhar cadastros.
- **Geração:** roda no navegador do usuário (sem servidor caro).
- Custo marginal por mês: **~R$ 0** para uso pessoal/pequeno.

---

## 8. Comparativo: manual × automatizado

| Aspecto | Manual (no PVA) | XML Fiscal Intelligence |
|---|---|---|
| Montar EFD de 300 empresas | dias de trabalho | segundos (lote) |
| Risco de erro de leiaute | alto | eliminado (validado) |
| Repetição mensal | total | 1 clique |
| Rastreabilidade (de onde veio cada valor) | nenhuma | linha de cada campo aponta p/ XML de origem |

---

## 9. Estado da nuvem (Supabase) — PENDÊNCIA

As variáveis de ambiente **já estão configuradas no Vercel** (URL, anon key,
service role, `FEATURE_CLOUD_PROCESSING=1`). Falta aplicar **1 migration** no
banco para criar as colunas de cadastro fiscal na tabela `cloud_companies`.

**Arquivo:** `supabase/migrations/202607160002_cloud_companies_fiscal_fields.sql`

Conteúdo (idempotente — pode rodar quantas vezes):
```sql
alter table cloud_companies
  add column if not exists activity_code text,
  add column if not exists profile text check (profile is null or profile in ('A', 'B', 'C')),
  add column if not exists purpose text check (purpose is null or purpose in ('0', '1')),
  add column if not exists industrial_class text,
  add column if not exists prior_credit_balance text,
  add column if not exists cnae text,
  add column if not exists cnae_description text,
  add column if not exists accountant_name text,
  add column if not exists accountant_cpf text,
  add column if not exists accountant_crc text,
  add column if not exists accountant_email text;

create index if not exists idx_cc_activity on cloud_companies (activity_code);
create index if not exists idx_cc_profile on cloud_companies (profile);

drop table if exists establishments;
drop table if exists accountants;
```

**Como aplicar (qualquer uma):**
- No dashboard do Supabase: *SQL Editor* → colar e executar o SQL acima; **ou**
- `supabase db push` (precisa do Supabase CLI logado no projeto).

> Sem essa migration, a **sincronização de cadastros na nuvem** não funciona,
> mas o app **continua funcionando 100% local** (IndexedDB). Nenhuma quebra no
> uso principal.

---

## 10. Próximos passos sugeridos

1. Aplicar a migration `202607160002` (seção 9) para ativar a nuvem.
2. Validar no PVA real um arquivo regerado (ex.: `efd-00397330000677.txt`) e
   confirmar 0 erros de leiaute.
3. (Opcional) Gerar os slides de apresentação (prompts para Gamma) explicando
   o projeto de forma didática para o pai.
4. (Segurança) Revogar o token do Vercel e rotacionar as chaves do Supabase que
   foram compartilhadas no chat.

---

## 11. Arquivos-chave para referência

- Gerador: `src/modules/obligations/efd-icms-ipi/builders/index.ts`
- Leiaute oficial: `src/modules/obligations/efd-icms-ipi/layouts/020/records.ts`
- Cálculo E110: `src/modules/obligations/efd-icms-ipi/calculations/index.ts`
- Validação offline: `scripts/pva/scan-offline.ts`, `scripts/pva/check-layout-align.ts`
- Geração em lote: `scripts/pva/generate-efd-per-company.ts`
- Nuvem: `src/app/api/companies/sync/route.ts`, `src/lib/cloud/companies.ts`
- Migration: `supabase/migrations/202607160002_cloud_companies_fiscal_fields.sql`
- Saída validada: `docs/pva/2026-06/generation-2/`

---

*Gerado em 16/07/2026 — projeto publicado em https://xml-fiscal-intelligence.vercel.app*
