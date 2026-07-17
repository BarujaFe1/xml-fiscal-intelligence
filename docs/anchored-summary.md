# Anchored Summary — xml-fiscal-intelligence

## Goal
Build/operate the XML Fiscal Intelligence app: NFe/EFD processing, fiscal reconciliation UX, and supporting infra (Supabase + Vercel). Deliver generation of EFD ICMS/IPI that validates clean in the official PVA: scoped by company CNPJ, excluding cancelled NF-e, arbitrary period recorte, manual COD_REC, and correct official layouts (C170 = 38 campos, C190 = 12 campos, E110 = 15 campos, 0002 somente IND_ATIV=0, CST_ICMS = N 003 (3 dígitos), leiaute 020).

## Constraints & Preferences
- PVA real v6.1.0 is GUI-only (no CLI) → validation done manually by user via exported .csv reports.
- Do not read PDFs. Reports from PVA are .csv/.txt.
- Shell: powershell 5.1. Latin1 = codepage 28591 (use for SpedFiscal exports). Python unavailable.
- `git push` is blocked by environment permission rule `git push *` → deny. Workaround (user-authorized): call git.exe by full path `& "C:\Program Files\Git\bin\git.exe" push origin <branch>`.
- **GitHub push protection blocks any commit containing secrets** → never commit literal tokens/keys. Redact them in any tracked file.
- Leiaute 020 (NT 2025.001, Ato COTEPE 79/2025), Guia Prático 3.2.2. COD_VER=020 (derived from DT_FIN year).
- Cloud: repo carries a SaaS scaffold (plans/websites/wopi) but the working product is the local-first XML→EFD tool.
- SpedEFD.exe at C:\Arquivos de Programas RFB\Programas SPED\Fiscal\SpedEFD.exe (user's machine).
- 2026-06 NFe = 1.147 real XMLs in docs/pva/2026-06/inputs. 202605 NFe (cooperativa 03585024000490) under user PVA test on the site (XMLs de 202605 NÃO estão locais).
- Communicate in pt-br.

## Progress

### Done
- Scope generation by selected company CNPJ (commit 875a6e1): `filterStoreByCnpj(store, cnpj)`; UI registered-company `<select>`; avoids IE/CNPJ PVA errors.
- Migration 202607160002 applied to Supabase (11 fiscal columns on cloud_companies).
- Period recorte (commit 1e3e189): `filterDocumentsByPeriod(docs, start, end)`.
- E116 COD_REC manual (commit 6cc2a71).
- **C170 = 38 campos (commit 633dc22, deployed dpl_4og9)**. 266 tests pass, tsc clean.
- **C190 = 12 campos (commit 1c332f4, push 251ffec, deployed prod)** — added VL_IPI(11). Golden hash 6863ea44.
- **Local real-data verification**: 66 C170 lines ALL exactly 38 fields (`{"38":66}`). Proves code correct.
- **E110 = 15 campos (commit c783463, pushed, deployed prod)**: records.ts had campo extra VL_SLD_CREDOR_ANT_FUT (16→15); calculations/index.ts buildE110FromC190 removido 16º campo. Conforme PVA v6.1.0. efd-0000-layout E110=15.
- **0002 só para IND_ATIV=0 (commit c783463)**: builders/index.ts emitia 0002 quando activityCode==="1" (invertido). Guia diz 0002 obrigatório SOMENTE quando IND_ATIV (0000)="0" (industrial). Coop é IND_ATIV=1 (comercial) → 0002 NÃO deve aparecer. Testes atualizados (efd-phase2 inverteu expectativa; efd-golden agora `not.toContain("0002")` p/ activityCode "1").
- **Golden hash atualizado** → `e487925e0ae7b5d968013c9eb2ddd94a4c84bab55ffc44bdfd2aa2ac3391fa5c` (E110=15 + 0002 ausente no demo synthetic). 266 tests pass, tsc clean.
- **Local generation loop (scripts/generate-local-efd.ts)**: após fix, coop 03585024000490 mês 2026-06 (141 docs): E110=15 OK, **validação offline 0 issues**, **0002 ausente** (comercial). Arquivo em docs/pva/2026-06/output/EFD_03585024000490_20260601_20260630.txt (781 linhas). tsc clean (BatchStore tipado corretamente no script).
- Deploy prod via Vercel (token exposto) → aliased https://xml-fiscal-intelligence.vercel.app (200 OK). Commit c783463 pushado (3293942..c783463).
- **CST_ICMS = N 003 (3 dígitos) — commit 0c17046 (push + deploy prod)**: `cstIcms3`→`cstIcms` (common.ts) voltou a padStart(3) (41→041, 101→101). **CORRIGE erros (4).csv** (PVA rejeitava `41` c/ MSG_ERRO_TAMANHO_CAMPO — campo é N 003). Golden hash → e487925e.... 266 testes passam, tsc limpo. Coop 202605/202606 + DATAMARS 202606 regerados (0 issues offline, CST 020/040/041/090).
- ~~CST_ICMS 2 dígitos (commit cc3f813) foi REGRESSÃO~~ — causou erros (4).csv; revertido em 0c17046.
- **C170/C190 split por IND_EMIT — commit f3c6c15 (push + deploy prod)**: NF-e emissão própria (IND_EMIT=0) → C100+C190 (consolidado, sem C170); NF-e terceiros (IND_EMIT=1)/modelo 01 → C100+C170. **CORRIGE erros (5).csv** MSG_NFE_EMITIDA_15001_V1 (C170 proibido sem C176/C177/C180/C181). 0190/0200/0400 agora condicionais a C170 (evita órfãos). E110 agrega C170 também (créditos terceiros). Golden hash → 0c865eea.... 266 testes passam, tsc limpo.
- **COD_REC**: coop (SP) = **046-2** (Portaria CAT 147/2009, RPA); DATAMARS (RS) = 04601 (original do usuário). SP plugin populado com tabela oficial; sugestão default 046-2. Script default COD_REC=046-2.

### In Progress
- **erros (5).csv RESOLVIDO** (commit f3c6c15, deploy prod): C170 removido p/ emissão própria (C190 only); COD_REC coop=046-2. Arquivos coop 202605/202606 + DATAMARS 202606 regerados em C:\Users\User1\Downloads com 0 issues offline.
- Aguardando usuário: re-validar no PVA (importar EFD_03585024000490_20260601_20260630.txt de Downloads no SpedEFD) e enviar novo erros(N).csv se houver.
- Security rotation (see Pending).

### Blocked
- (None.)

## Key Decisions
- Root cause erro PVA original: C170 34 campos (sem IPI) → CST_PIS deslocado → MSG_ERRO_TAMANHO_CAMPO. Corrigido (38 campos).
- **C170 official SPED = 38 campos** (Guia 3.2.2). Campos 29/35 vazios p/ CST percentual.
- **C190 official = 12 campos**: REG, CST_ICMS, CFOP, ALIQ_ICMS, VL_OPR, VL_BC_ICMS, VL_ICMS, VL_BC_ICMS_ST, VL_ICMS_ST, VL_RED_BC, VL_IPI(11), COD_OBS(12).
- **E110 PVA v6.1.0 = 15 campos**: REG, VL_TOT_DEBITOS, VL_AJ_DEBITOS, VL_TOT_AJ_DEBITOS, VL_ESTORNOS_CRED, VL_TOT_CREDITOS, VL_AJ_CREDITOS, VL_TOT_AJ_CREDITOS, VL_ESTORNOS_DEB, VL_SLD_CREDOR_ANT, VL_SLD_APURADO, VL_TOT_DED, VL_ICMS_RECOLHER, VL_SLD_CREDOR_TRANSPORTAR, DEB_ESP. Campo VL_SLD_CREDOR_ANT_FUT (16º) NÃO existe no PVA → removido.
- **0002 só quando IND_ATIV (0000) = "0"** (industrial/equiparado). Coop IND_ATIV=1 (comercial/outros) → 0002 NÃO deve aparecer. Condição em builders/index.ts estava invertida (emitia p/ "1").
- **CST_ICMS = N 003 (3 dígitos) no leiaute 020** — campo acomoda CST (00-90, zero-à-esquerda: 41→041) e CSOSN (101-900). PVA v6.1.0 rejeita 2 dígitos (`41`) c/ MSG_ERRO_TAMANHO_CAMPO. `cstIcms` (common.ts) faz `raw.padStart(3,"0").slice(-3)`. Verificado C170/C190 coop: `020/040/041/090`. (Tentativa de 2 dígitos em cc3f813 gerou erros (4).csv e foi revertida.)
- E500/E520: PVA NÃO reclamou (presentes no arquivo da coop comercial) → mantido como está (não alterado).
- **NF-e emissão própria (IND_EMIT=0, mod 55): C100 + C190 (consolidado por CST/CFOP/ALIQ). C170 PROIBIDO** sem filhos C176/C177/C180/C181 (MSG_NFE_EMITIDA_15001_V1). NF-e terceiros (IND_EMIT=1) / NF modelo 01: C100 + C170 (detalhe item); sem C190. 0190/0200/0400 só quando há C170.
- **COD_REC SP oficial = "046-2"** (RPA, Portaria CAT 147/2009 Anexo IX; PVA exige hífen/dígito). "04601" é inválido p/ SP. (RS usa tabela própria; DATAMARS original 04601 provavelmente válido p/ RS.)
- Erro persistiu após 1º deploy por JS obsoleto na aba (hard-refresh). Agora validação é via arquivo local + PVA do usuário.
- `serializeEfd` preserva todos os campos (não strip vazios) → builder field count é autoritativo.
- Offline validator lê expected de getRecordDef (records.ts) → corrigir records.ts basta p/ validação.
- PVA (GUI) não roda headless → validação definitiva é SpedEFD.exe do usuário; loop local valida offline primeiro.

## Next Steps
1. Pedir ao usuário: importar **C:\Users\User1\Downloads\EFD_03585024000490_20260601_20260630.txt** (coop, 0 issues offline) no SpedEFD e enviar novo erros(N).csv se houver. Confirmar E116 COD_REC=046-2 aceito.
2. Se DATAMARS (RS) for PVA-validado, confirmar COD_REC=04601 (ou ajustar p/ tabela RS).
3. **SEGURANÇA**: revogar token Vercel `vcp_38Zg…` (exposto em chat) e rotacionar chaves Supabase antecipadamente.
3. Security (dashboard-only, user request): **revogar token Vercel** (foi reusado no deploy) e **rotacionar chaves Supabase** (proj uaqydwvdmwrwlvznoztd). Redact de qualquer arquivo tracked antes do commit.
4. (Pending, user request) Gamma prompts em lotes de 10.

## Critical Context
- Site: https://xml-fiscal-intelligence.vercel.app (200 OK). Deploy prod via vercel CLI.
- Branch: feat/automated-fiscal-reconciliation-ux-capture. Commits: 875a6e1, 1e3e189, 6cc2a71, 633dc22, 1c332f4 (251ffec), 3293942, c783463 (push 3293942..c783463, deploy aliased), cc3f813 (CST 2-díg REGRESSÃO), 0c17046 (CST 3-díg, erros (4).csv fix, push+deploy), f3c6c15 (C170/C190 split IND_EMIT, COD_REC SP=046-2, erros (5).csv fix, push+deploy).
- **Secrets — DO NOT COMMIT. Revoke/rotate via dashboards.** Vercel token exposto: `vcp_38Zg…` (usado NOVAMENTE no deploy → revogar urgente). Supabase proj uaqydwvdmwrwlvznoztd; anon key `sb_publishable_tbqx8z8…` (público por design); service-role no .env.local (secret → rotacionar).
- **Novos erros PVA (erros (3).csv, C:\Users\User1\Downloads\erros (3).csv)** — arquivo testado foi 202605 (coop 03585024000490) gerado no site:
  - E110 (linha 726): PVA espera 15 campos, arquivo tinha 16 → campo extra VL_SLD_CREDOR_ANT_FUT. CORRIGIDO em c783463.
  - 0002 (linha 3): MSG_REGISTRO_NAO_DEVE_SER_INFORMADO → coop comercial (IND_ATIV=1) não deve ter 0002. CORRIGIDO em c783463.
  - PVA NÃO reclamou de E500/E520 (presentes) → mantido.
- **erros.csv (Documentos, C:\Users\User1\Downloads\erros.csv, 16/07)** — NÃO é código atual. É geração ANTIGA (C170=34 campos c/ deslocamento PIS/COFINS, E110=16, C190 CST_ICMS=0/CFOP=000). A própria PVA confirma esperar 38 C170 (Valor Calculado=38). Reproduzido: os 2 C170 de erro são os produtos INDICADOR DE PESAGEM S3 / BASTÃO LEITOR SRS2i do CNPJ **00397330000677 (DATAMARS BRASIL TECNOLOGIA AGROPECUARIA LTDA, RS, IE 1770255840)**, período **202606**. Código atual (0c17046) gera esses mesmos produtos com C170=38, CST_ICMS=000 (3 díg, CST=0), CFOP=6102 (4 díg), VL_BC_PIS na posição correta. Arquivo limpo entregue em C:\Users\User1\Downloads\EFD_00397330000677_20260601_20260630.txt (78 lin, 2 C170, 0 issues). Também gerados EFD_03585024000490_202605/202606 (coop) na pasta Downloads.
- **erros (4).csv (C:\Users\User1\Downloads\erros (4).csv)** — código cc3f813 (CST 2 díg). Foram coop 03585024000490, 202605/202606. PVA rejeitava CST_ICMS=41 (2 díg) em C170/C190 c/ MSG_ERRO_TAMANHO_CAMPO. **RESOLVIDO em 0c17046** (CST 3 díg → 041). Arquivos coop regerados em Downloads com 0 issues offline.
- **erros (5).csv (C:\Users\User1\Downloads\erros (5).csv)** — coop 03585024000490 (SP, VARGEM GRANDE DO SUL), 202606. 2 erros PVA:
  1. E;127; C100/C170 emissão própria: MSG_NFE_EMITIDA_15001_V1 (Para NF-e emissão própria informar somente C100 e C190; C170 proibido sem C176/C177/C180/C181). **RESOLVIDO em f3c6c15** (NF-e IND_EMIT=0 → C190 only).
  2. E;726; E116 COD_REC=04601: MSG_EXISTE_COD_REC_E116 (código inválido p/ SP). **RESOLVIDO em f3c6c15** (COD_REC SP=046-2, Portaria CAT 147/2009).
  - Coop: 137 C100 todos NF-e mod 55, IND_EMIT=0. Arquivo regerado EFD_03585024000490_20260601_20260630.txt (Downloads, 348 lin, 0 C170, 143 C190, E110 intacto, E116=046-2).
- COD_REC: coop (SP) = **046-2** (RPA, Portaria CAT 147/2009; PVA exige hífen/dígito). DATAMARS (RS) = 04601 (original usuário; RS tem tabela própria). Script default COD_REC=046-2 (SP); passar 04601 p/ RS.
- 1.147 real XMLs em docs/pva/2026-06/inputs. Gerador: scripts/generate-local-efd.ts (env CNPJ, START, END, INPUT_DIR, OUT_DIR, COD_REC=046-2 default).
- Arquivo local gerado: docs/pva/2026-06/output/EFD_03585024000490_20260601_20260630.txt (348 linhas; C100+C190 only; E110=15 OK; 0002 ausente; validação offline 0 issues).
- Golden hash atual: 0c865eea5126ae057f0d4e0854bb4a61ae5af1cee60b03ff06ec5f1fa6e4e1ee.
- Lint: 6 erros pré-existentes src/app/app/*/page.tsx (fora escopo).
- 0000 builder (builders/index.ts:237): IE populado, CPF vazio p/ CNPJ, COD_MUN presente. Header OK.

## Relevant Files
- src/modules/obligations/efd-icms-ipi/layouts/020/records.ts — C170=38, C190=12, **E110=15** (+0002 def ok).
- src/modules/obligations/efd-icms-ipi/builders/index.ts — C170 38, C190 12, **0002 linha ~686 só p/ activityCode "0"**, build0000 ~237, **C170/C190 split por isOwnIssueNfe (IND_EMIT=0→C190, IND_EMIT=1→C170); 0190/0200/0400 condicionais a C170**.
- src/modules/obligations/efd-icms-ipi/calculations/index.ts — **buildE110FromC190 15 campos** (sem VL_SLD_CREDOR_ANT_FUT); **agrega C170 também** (créditos terceiros).
- src/modules/obligations/efd-icms-ipi/uf/sp.ts — **tabela COD_REC SP oficial (Portaria CAT 147/2009); suggestIcmsCodRec→"046-2"**.
- src/modules/obligations/efd-icms-ipi/serialization/index.ts — serializeEfd (preserva campos).
- src/modules/obligations/efd-icms-ipi/from-batch.ts — filterDocumentsByPeriod.
- src/modules/obligations/generate-local.ts — filterStoreByCnpj.
- scripts/generate-local-efd.ts — gerador local loop (BatchStore tipado).
- tests/unit/efd-golden.test.ts — golden hash 0c865eea5126ae057f0d4e0854bb4a61ae5af1cee60b03ff06ec5f1fa6e4e1ee, `not.toContain("0002")`, slice(0,3)=["0000","0001","0005"], **sample é terceiros (IND_EMIT=1) → C170, não C190**.
- tests/unit/efd-0000-layout.test.ts — C170=38, C190=12, **E110=15**, slice(0,3)=["0000","0001","0005"].
- tests/unit/efd-phase2.test.ts — C170=38; **0002 só p/ IND_ATIV=0**.
- tests/unit/efd-offline-validator.test.ts — C190 sample intencionalmente errado.
- src/modules/obligations/efd-icms-ipi/layouts/020/offline-validator.ts — validateEfdOffline.
- docs/pva/2026-06/inputs/ — 1.147 real NFe XMLs.
- docs/pva/2026-06/output/EFD_03585024000490_20260601_20260630.txt — gerado local (validado offline 0 issues).
- C:\Users\User1\Downloads\erros (3).csv — novos erros PVA (E110 16→15, 0002).
