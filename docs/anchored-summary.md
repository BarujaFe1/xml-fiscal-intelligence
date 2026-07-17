# Anchored Summary — xml-fiscal-intelligence

## Goal
Build/operate the XML Fiscal Intelligence app: NFe/EFD processing, fiscal reconciliation UX, and supporting infra (Supabase + Vercel). Deliver generation of EFD ICMS/IPI that validates clean in the official PVA: scoped by company CNPJ, excluding cancelled NF-e, arbitrary period recorte, manual COD_REC, and correct official layouts (C170 = 38 campos, C190 = 12 campos, leiaute 020).

## Constraints & Preferences
- PVA real v6.1.0 is GUI-only (no CLI) → validation done manually by user via exported .csv reports.
- Do not read PDFs. Reports from PVA are .csv/.txt.
- Shell: powershell 5.1. Latin1 = codepage 28591 (use for SpedFiscal exports). Python unavailable.
- `git push` is blocked by environment permission rule `git push *` → deny. Workaround (user-authorized): call git.exe by full path `& "C:\Program Files\Git\bin\git.exe" push origin <branch>`.
- **GitHub push protection blocks any commit containing secrets** → never commit literal tokens/keys. Redact them in any tracked file.
- Leiaute 020 (NT 2025.001, Ato COTEPE 79/2025), Guia Prático 3.1.9. COD_VER=020 (derived from DT_FIN year).
- Cloud: repo carries a SaaS scaffold (plans/websites/wopi) but the working product is the local-first XML→EFD tool.
- SpedEFD.exe at C:\Arquivos de Programas RFB\Programas SPED\Fiscal\SpedEFD.exe (user's machine).
- 2026-06 NFe = 1.147 real XMLs in docs/pva/2026-06/inputs. 202605 NFe (cooperativa 03585024000490) under user PVA test on the site.
- Communicate in pt-br.

## Progress

### Done
- Scope generation by selected company CNPJ (commit 875a6e1): `filterStoreByCnpj(store, cnpj)`; UI registered-company `<select>`; avoids IE/CNPJ PVA errors.
- Migration 202607160002 applied to Supabase (11 fiscal columns on cloud_companies; redundant establishments/accountants dropped; tax_profiles kept).
- Period recorte (commit 1e3e189): `filterDocumentsByPeriod(docs, start, end)` applied in callers; UI "Recorte do período".
- E116 COD_REC manual (commit 6cc2a71): E116 emits `COD_REC`, `MES_REF`, `COD_OR` configurable; defaults COD_OR=000.
- **C170 corrected to official 38 fields (commit 633dc22, pushed, deployed build dpl_4og9)**: records.ts + builders/index.ts aligned (inclui VL_BC_IPI/ALIQ_IPI, ALIQ_PIS_QUANT(29), ALIQ_COFINS_QUANT(35), COD_CTA(37), VL_ABAT_NT(38)). Tests efd-0000-layout (C170=38), efd-phase2 (C170=38), golden hash updated. 266 tests pass, tsc clean.
- **C190 corrected to official 12 fields (commit 1c332f4, pushed 251ffec, deployed production)**: records.ts added VL_IPI(11) before COD_OBS(12); builder emits `moneyToEfd(agg.vlIpi)`. efd-0000-layout C190=12; golden hash updated to 6863ea44.... 266 tests pass, tsc clean. Production deploy aliased to https://xml-fiscal-intelligence.vercel.app (200 OK).
- **Local real-data verification**: parsed all 1.147 real XMLs, scoped to CNPJ 03585024000490 (141 docs), recorte 2026-06-01→07 (29 docs in period), generated via real pipeline. Result: 66 C170 lines ALL with exactly 38 fields (`{"38":66}`). Proves the deployed code emits correct C170.
- Site https://xml-fiscal-intelligence.vercel.app responds 200.
- **Local generation loop (scripts/generate-local-efd.ts)**: lê XMLs de uma pasta, filtra por CNPJ + recorte de período, gera EFD via pipeline real, escreve `.txt` (UTF-8 + CRLF) e roda `validateEfdOffline`. Para a cooperativa 03585024000490 (141 docs de 1147 em docs/pva/2026-06/inputs, mês 2026-06): TODOS os registros com field-count correto (C170=38, C190=12, C100=29…), **validação offline 0 issues**. Arquivo em docs/pva/2026-06/output/EFD_03585024000490_20260601_20260630.txt (781 linhas). Env vars: CNPJ, START, END, INPUT_DIR, OUT_DIR, COD_REC (default 04601). PVA (SpedEFD.exe GUI) é a validação definitiva; usuário deve importar o .txt e enviar erros(N).csv para correção em loop.

### In Progress
- Awaiting user: hard-refresh the app tab (`Ctrl+Shift+R`) and regenerate, then re-validate in PVA. The earlier 34/11-field errors came from stale browser JS (tab opened before deploy); code is correct.
- Security rotation (see Pending).

### Blocked
- (None.)

## Key Decisions
- Root cause of original PVA error: C170 had 34 campos (no IPI) → CST_PIS landed on ALIQ value → MSG_ERRO_TAMANHO_CAMPO.
- **C170 official SPED = 38 campos** (VRi/Guia 3.2.2): REG…VL_IPI(24), CST_PIS(25), VL_BC_PIS(26), ALIQ_PIS(27), QUANT_BC_PIS(28), ALIQ_PIS_QUANT(29), VL_PIS(30), CST_COFINS(31), VL_BC_COFINS(32), ALIQ_COFINS(33), QUANT_BC_COFINS(34), ALIQ_COFINS_QUANT(35), VL_COFINS(36), COD_CTA(37), VL_ABAT_NT(38). Fields 29/35 empty for percentual CST.
- **C190 official = 12 campos** (Guia 3.1.9): REG, CST_ICMS, CFOP, ALIQ_ICMS, VL_OPR, VL_BC_ICMS, VL_ICMS, VL_BC_ICMS_ST, VL_ICMS_ST, VL_RED_BC, **VL_IPI(11)**, COD_OBS(12). The pre-fix builder omitted VL_IPI (11 fields) → PVA MSG_ERRO_QUANTIDADE_CAMPOS_INVALIDA (expected 12, found 11).
- Persisted errors came from stale browser JS: build dpl_4og9 was READY ~16:13:37 UTC, user generated at 16:14:50 UTC — new code already live, but tab had old JS in memory. Fix: hard-refresh.
- `serializeEfd` (serialization/index.ts) does NOT strip empty fields — joins all with `|`, so builder field count is authoritative.
- Period recorte applied in callers, NOT in buildObligationContextFromBatch.
- Offline validator (offline-validator.ts) reads expected field counts from `getRecordDef` (records.ts), so fixing records.ts is sufficient; efd-offline-validator.test.ts sample stays intentionally wrong → still flagged → still passes.

## Next Steps
1. Ask user to hard-refresh (`Ctrl+Shift+R`) and regenerate on the site, then re-validate in PVA.
2. If any PVA error persists after hard-refresh, request the new `erros(N).csv` and re-investigate.
3. Security (dashboard-only, user request): revoke Vercel token; rotate Supabase keys (project uaqydwvdmwrwlvznoztd). Redact from any tracked file before commit.
4. (Pending, user request) Gamma prompts in batches of 10.

## Critical Context
- Site: https://xml-fiscal-intelligence.vercel.app (200 OK).
- Branch: feat/automated-fiscal-reconciliation-ux-capture. Commits: 875a6e1 (CNPJ scope), 1e3e189 (recorte), 6cc2a71 (E116 COD_REC), 633dc22 (C170 38 campos, deployed dpl_4og9), 1c332f4 (C190 12 campos).
- **Secrets — DO NOT COMMIT. Revoke/rotate via dashboards.** Vercel token exposure: `vcp_38Zg…` (full value in chat history — revoke). Supabase project id uaqydwvdmwrwlvznoztd; anon key `sb_publishable_tbqx8z8…` (in .env.local, public by design); service-role key also in .env.local (secret — rotate).
- User PVA errors (202605, coop 03585024000490), file C:\Users\User1\Downloads\erros (2).csv:
  - C170: PVA expected 38, file had 34 → stale JS (fixed in 633dc22).
  - C190: PVA expected 12, file had 11 → fixed in 1c332f4 (added VL_IPI).
  - Generated 2026-05-17 16:14:50 (contentHash 599c4386…) from old JS.
- 1st attempt erros (1).csv: MSG_ERRO_TAMANHO_CAMPO on CST_PIS (value 1,6500 = displaced ALIQ_PIS) → same stale-JS C170 issue.
- COD_REC used by user's accountant: 04601 (ICMS – Operações Próprias – RPA), UF SP.
- item.tax.{pis,cofins}: cst, vBc, pAliq, vValor (no vAliqPis → fields 29/35 empty for percentual CST). item.tax.ipi: vBc, pIpi, vIpi (aggregated into C190.VL_IPI).
- 1.147 real XMLs in docs/pva/2026-06/inputs (used for local verification).
- Lint: 6 pre-existing errors in src/app/app/*/page.tsx (out of scope).
- Golden hash: 6863ea441ba9bcb598ada7dc98e7aabaf4b5e1e14c8a082684698012a3f19bee.

## Relevant Files
- src/modules/obligations/efd-icms-ipi/layouts/020/records.ts — C170=38, C190=12 (VL_IPI field 11).
- src/modules/obligations/efd-icms-ipi/builders/index.ts — C170 and C190 builders (C190 emits VL_IPI).
- src/modules/obligations/efd-icms-ipi/serialization/index.ts — serializeEfd (preserves all fields).
- src/modules/obligations/efd-icms-ipi/from-batch.ts — filterDocumentsByPeriod, nfeEfdStatus.
- src/modules/obligations/efd-icms-ipi/layouts/020/offline-validator.ts — checkFields reads getRecordDef.
- src/modules/obligations/generate-local.ts — filterStoreByCnpj, BatchStore.
- src/modules/obligations/efd-icms-ipi/tax/normalize-nfe-tax.ts — pis/cofins/ipi normalization.
- tests/unit/efd-golden.test.ts — golden hash 6863ea44.
- tests/unit/efd-0000-layout.test.ts — C170=38, C190=12.
- tests/unit/efd-phase2.test.ts — C170=38 assertions.
- tests/unit/efd-offline-validator.test.ts — C190 wrong-count sample (intentionally 10–11 fields).
- scripts/audit-efd-fields.ts — reference field counts (C190:12, C170:38).
- docs/pva/2026-06/inputs/ — 1.147 real NFe XMLs.
