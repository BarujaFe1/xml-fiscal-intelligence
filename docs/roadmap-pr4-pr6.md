# Roadmap PR4–PR6 — XML Fiscal Intelligence

> Ponto de revisão. PR3 (gerador EFD ICMS/IPI) está validado offline (301/301 arquivos, 0 erros);
> falta o gate manual no PVA 6.1.0 (GUI). PR4–PR6 documentados aqui para aprovação.

## Status de PR3 (base)
- Gerador EFD ICMS/IPI, leiaute **020** (NT 2025.001 / Ato COTEPE 79/2025), Guia 3.2.2.
- Refatorado em `constants.ts` / `common.ts` / `builders/` / `calculations/` / `serialization/`.
- Validação offline (`validateEfdOffline`) em todos os 300 CNPJs + golden: **RULE COUNTS: {}**.
- Golden hash `2a1e585e…`; combined hash `17a839a6…` (reprodutível).
- 255 testes passam; typecheck/lint limpos (exceto 6 erros pré-existentes em `src/app/app/*`, fora do escopo).
- **Bloqueio**: gate manual PVA (v6.1.0 é GUI-only) depende do usuário. Deploy deferido (token Vercel vazado não reutilizado).

---

## PR4 — Cadastro real + Supabase RLS + registry `ObligationSupportLevel`

**Problema hoje**: o cadastro (contador NOME/CPF/CRC, `IND_ATIV`, `CLAS_ESTAB_IND`,
`priorCreditBalance`, `COD_MUN`, `IE`) não vem dos XMLs. PR3 assume via fixture
sanitizada (`FiscalDatasetKind`). Isso trava a exatidão de `0002`/`0100`/`E110`.

**Entregáveis**
1. **Registry `ObligationSupportLevel`** — tipo/enum por obrigação × UF × situação
   (`supported` / `partial` / `unsupported`), dirigido por `uf/registry` + `official_sources`.
   Substitui a heurística `emptyUfPlugin`.
2. **Cadastro UI (Next.js)** — formulário de estabelecimento: CNPJ, IE, UF, COD_MUN,
   perfil A/B/C, `IND_ATIV`, contador (NOME+CPF+CRC obrigatório), `priorCreditBalance`.
   Validação via `detectEfdRequiredData` (já implementada).
3. **Supabase schema + RLS** — tabelas `establishments`, `accountants`, `obligations`;
   RLS por `workspace_id`/`user_id`; políticas de leitura/escrita. Sem expor dados entre workspaces.
4. **Wiring** — `buildObligationContextFromBatch` lê do DB em vez de fixture; geração
   idempotente por CNPJ/período.

**Critério de aceite**: sem defaults silenciosos (erro/warning explícito quando faltar
dado obrigatório); um EFD por CNPJ reproduzível a partir do cadastro + XML.

---

### Status de PR4 (implementado nesta sessão)
- ✅ **Registry `ObligationSupportLevel`** (`src/modules/obligations/support-level.ts`) + integração em `getEfdUfPlugin` (`supportLevel`).
- ✅ **Modelo de cadastro estendido** (`src/lib/store/local-cadastro.ts`): campos `activityCode`, `profile`, `purpose`, `industrialClass`, `priorCreditBalance`, `cnae`, `cnaeDescription`, `accountantEmail`; merge + patch atualizados.
- ✅ **Mapper `cadastroToEstablishmentFiscalInput`** → `EstablishmentFiscalInput` (camada de dados pronta para o gerador ler cadastro real em vez de fixture).
- ✅ **`priorCreditBalance`** agora flui `EstablishmentFiscalInput` → `ObligationContext` → `E110`.
- ✅ **Migration Supabase (consolidada)** `supabase/migrations/202607160002_cloud_companies_fiscal_fields.sql`: estende `cloud_companies` (que já espelha o cadastro via `payload_json`) com colunas indexadas `activity_code`, `profile`, `purpose`, `industrial_class`, `prior_credit_balance`, `cnae`, `cnae_description`, `accountant_*`. **Remove** as tabelas paralelas `establishments`/`accountants` de `202607160001` (redundantes frente a `cloud_companies`); `202607160001` foi deletada.
- ✅ **API de cadastro em nuvem** `src/app/api/companies/sync/route.ts`: `POST` persiste o `LocalCompany` completo (`payload_json` + colunas fiscais) e `GET` reconstrói `LocalCompany` do `payload_json`. Reuso de `ensureWorkspace` + `uuidFromLocalKey` (padrão do repo).
- ✅ **Helper client** `src/lib/cloud/companies.ts` (`syncCompaniesWithCloud`, `syncCloudToLocal`, `pushCompaniesToCloud`, `loadCloudCompanies`): gating client-safe via `isSupabaseConfigured()`; fallback silencioso para local quando a API volta 503.
- ✅ **Wire da UI** `src/app/app/companies/page.tsx`: `refresh()` faz two-way sync (push local→cloud, pull cloud→local). EFD page já consome o cadastro local (que fica em cache sincronizado). Local-first preservado quando sem credenciais.
- ✅ **`.env.example`** documentando `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only) e `FEATURE_CLOUD_PROCESSING=1`.
- ✅ **Testes** `obligation-support-level.test.ts` (4) + `cadastro-to-fiscal.test.ts` (3). Suíte: 262 passam; typecheck limpo.
- ⏳ **Ativar em runtime** (precisa de ação do usuário): (1) aplicar a migration `202607160002` no projeto Supabase; (2) preencher `.env.local` (dev) e as env da Vercel (prod) com as 3 credenciais + `FEATURE_CLOUD_PROCESSING=1`; (3) redefinir `FEATURE_CLOUD_PROCESSING`/redeploy se necessário. Até lá, o app roda local-first (IndexedDB).

---

## PR5 — Reports / PDF

- Export do EFD validado em **PDF** (recibo de transmissão / relatório de apuração) + CSV de auditoria.
- Camada de reporting reutilizável (`reports/`) com templates por obrigação.
- Histórico de gerações via `manifest` (já emitido por `createEfdManifest`) por período/estabelecimento.
- Integra com o disclaimer obrigatório ("não constitui parecer fiscal").

---

## PR6 — Multi-SPED

- Pipeline genérico para outras obrigações SPED (ECD, ECF, PIS/COFINS, eSocial) reusando
  `FiscalObligationPlugin`, `ObligationContext`, `validate-structure`, `offline-validator`.
- Seleção dirigida por registry (`ObligationSupportLevel`); um arquivo por obrigação/período; agendamento.
- Reuso dos padrões de `serialization/` e `calculations/` já estabelecidos em PR3.
- Sincronização com a nuvem (`local_prototype` → Supabase) por workspace.

---

## Riscos / bloqueios abertos
- **Gate manual PVA** ainda pendente (validação real). Iterar sobre `erros.csv` do usuário.
- **Token Vercel comprometido** — não reutilizar `vcp_…`; revogar e usar token novo antes de deploy.
- **Cadastro real** fora do rascunho (assumido via fixture) — resolvido em PR4.

## Próximo passo
Este doc é ponto de parada. Aprovar PR4 para iniciar implementação (cadastro + RLS + registry).
