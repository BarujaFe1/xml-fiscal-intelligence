# SUPER PROMPT — Plano de produção do "XML Fiscal Intelligence"
> **Modo:** você (ChatGPT, com raciocínio profundo / thinking) deve responder em **MODO PLANO**.
> Não implemente código diretamente (você não tem acesso ao repositório). Entregue um **plano detalhado e acionável** que o agente **opencode (Claude)** executará no repositório e no disco do usuário.
> Pode responder em **português** (domínio fiscal brasileiro).

---

## 0. Como a equipe funciona (leia antes de tudo)

Esta é uma **equipe de dois agentes**:

| Papel | Quem | O que faz |
|---|---|---|
| **Planejador / Arquiteto** | **Você (ChatGPT, modo thinking)** | Lê este prompt + os prints (zip anexo) + os PDFs oficiais da Receita Federal; raciocina com profundidade; entrega o **plano** numerado, com arquivos a mexer, comandos e **links oficiais exatos** dos manuais/leiautes que corrigem cada problema. |
| **Executor** | **opencode (Claude)** | Tem acesso ao repositório Git, ao disco Windows do usuário, pode editar arquivos, rodar o `SpedEFD.exe`, rodar testes/lint/build, commitar e fazer **deploy na Vercel**. Executa o plano e sobe a versão. |

**Fluxo:** você entrega o PLANO → o usuário repassa o plano ao opencode → opencode executa, valida (inclusive com o `SpedEFD.exe`) e faz o deploy.

**O que VOCÊ (ChatGPT) consegue fazer que o opencode não consegue tão bem:**
- Ler, interpretar e cruzar os **PDFs/manuais oficiais da RFB** (Guia Prático SPED Fiscal, leiautes, manual do PVA, etc.) e apontar os **links exatos** que corrigem cada item.
- Ter **visão holística/arquitetural** de todo o produto e propor melhorias amplas de UI/UX, funcionalidades e PDFs.
- Raciocínio profundo sobre o domínio fiscal.

**O que o opencode faz:** executa, edita arquivos reais, roda o validador RFB localmente, testa, commita e publica.

---

## 1. O projeto

- **Nome:** XML Fiscal Intelligence
- **Propósito:** reconciliação fiscal automatizada, geração e validação de **SPED EFD ICMS/IPI**, validação via **PVA** (Programa Validador da RFB), conferência de XML de NF-e, e cobertura multi-obrigação (EFD, ECD, ECF, REINF, Sped Contribuições…).
- **Stack:** Next.js (versão recente com **breaking changes** — ver `AGENTS.md`: *"This is NOT the Next.js you know"*, APIs/convenções diferentes do treinamento), React, TypeScript, Tailwind, componentes estilo shadcn (`src/components/ui`), **IndexedDB** como fonte de verdade local (`src/lib/store`), **Supabase** opcional (adapters definidos mas **não usados em runtime**), Playwright + Axe para guardas visuais/a11y, Vitest para testes unitários/RLS.
- **Repositório (GitHub):** https://github.com/BarujaFe1/xml-fiscal-intelligence
- **Branch atual:** `feat/automated-fiscal-reconciliation-ux-capture` (criado a partir de `feat/soc2-grounding-erp3`)
- **Deploy preview (PÚBLICO):** https://xml-fiscal-intelligence-kjdeln9lk-barujafe1s-projects.vercel.app
- **Deploy produção:** https://xml-fiscal-intelligence.vercel.app
- **SpedEFD (validador oficial RFB) no disco do usuário:** `C:\Arquivos de Programas RFB\Programas SPED\Fiscal\SpedEFD.exe`

**Scripts relevantes (`package.json`):** `dev`, `build`, `start`, `lint`, `typecheck`, `test` (vitest unit), `test:e2e` (playwright), `test:visual` (playwright + Axe, 11 rotas), `test:rls` (gated `RUN_RLS_LIVE`), `screenshots:all` (Playwright capture), `seed-demo` (fixtures determinísticos).

---

## 2. O que JÁ foi feito (para você não reinventar)

- **UX redesign** das 11 rotas capturadas: 18 primitivos em `src/components/design-system/*`; topbar com indicador discreto **"Dados neste dispositivo"**; sidebar reagrupada (Início/Importar/Conferir/Fechamentos + Análise + Plataforma); configurações técnicas movidas para `TechnicalDetailsDrawer` ("Diagnóstico técnico"); billing com estado elegante quando indisponível.
- **A11y:** **0 violações críticas/sérias/moderadas** (Axe) nas 11 rotas (`test:visual` 11/11 verde). `CardTitle` tornou-se `level`-aware.
- **PVA (infra):** tipos `PvaValidationRun`/`PvaValidationMessage` (`src/modules/obligations/efd-icms-ipi/verification-types.ts`); pré-validador genérico de campos obrigatórios `prevalidate.ts` (semente para **Guia Prático 3.2.2 / 06-2026 / perfil A**); página de importação+mapeamento `src/app/app/obligations/efd-icms-ipi/pva/page.tsx`; migration `supabase/migrations/202607150001_pva_field_definitions.sql`. **Status atual: `pva_rejected`** (ver seção 3.1).
- **RLS:** suíte comportamental `tests/rls/real-rls.test.ts` (pg), gated em `RUN_RLS_LIVE`+`DATABASE_URL_TEST`, recusa host de produção. `rls-hygiene` offline verde.
- **Prints:** **273 PNGs** em `artifacts/ui-capture/after/` (3 engines × 3 viewports × 4 estados: empty/populated/error/restricted) + `contact-sheet.html`, `index.html`, `axe-report.json`.
- **Cloud:** classificado **`local_prototype`** — IndexedDB; Supabase = espelho unidirecional de metadados, nunca invocado em runtime.
- **Documentação:** `docs/REPORT_2026-06.md` (relatório completo §23), `docs/NORMATIVE_REGISTRY.md` (normas), `docs/CLOUD_STATUS_2026-06.md`, `docs/FISCAL_GUARDRAILS.md`, `docs/pva/2026-06/*`.

---

## 3. O que AINDA ESTÁ EM BETA / incompleto (foco do plano — "aplique absolutamente tudo")

### 3.1 PVA / SPED EFD (crítico)
- Geração 06/2026, perfil A, está com **2 erros de validação PVA não corrigidos** → status `pva_rejected`. O **relatório detalhado do PVA não está disponível neste ambiente** (só o resumo: competência, perfil, total, categoria "Campo obrigatório"). Registros/campos/linhas/valores exatos dos 2 erros são `blocked_external`.
- Arquivo reproduzível para validar: `private-exports/probe-efd-fix/efd.txt` (TXT de saída do gerador).
- **O arquivo SPED gerado NUNCA foi validado pelo `SpedEFD.exe` oficial.** Esta é a principal lacuna.
- Página de importação existe, mas não produz uma "Generation 2" validada.

### 3.2 `src/app/app/scale` — bug de hidratação
- `regionalHealthReport()` retorna valor não-determinístico (`regionsReachable`: server 3 × client 1) → React lança "Hydration failed" → `test:e2e` falha (`/app/scale renders without crash`). Pré-existente, fora das 11 rotas capturadas.

### 3.3 Páginas "phase surfaces" F10–F17 são sintéticas/mock
- `/app/scale` (DR drills, mass campaigns, hardening, metering), `/app/enterprise`, `/app/governance`, `/app/ecosystem`, `/app/compliance`, `/app/growth`, `/app/assurance`, `/app/m`, `/app/homologation` usam **dados sintéticos locais**; não há backend real. Muitas são placeholders.

### 3.4 Cloud ainda é `local_prototype`
- IndexedDB apenas; adapters Supabase (`BatchRepository` etc.) definidos mas **não usados em runtime**; sem multiusuário real; **RLS não aplicada em runtime**.

### 3.5 RLS não provada em Postgres real
- Suíte gated não executada (sem Postgres local; `DATABASE_URL` de produção não pode ser usado para testes destrutivos). `blocked_external`.

### 3.6 Outras obrigações
- Módulos ECD, ECF, REINF, Sped Contribuições podem ser stubs/placeholders (a página `/app/obligations` lista várias).

### 3.7 Geração de PDFs fiscais
- Relatórios/PDFs do app podem estar incompletos/beta (citados pelo usuário: "os pdfs").

### 3.8 Guardrails de honestidade
- Banners marcam várias coisas como beta/local (ex.: "Dados neste dispositivo", "sem relatório SOC2"). **Objetivo:** remover esses rótulos conforme cada parte vire produção-ready.

### 3.9 Cobertura de testes
- Só chromium/desktop teve evidência real; cross-browser (firefox/webkit) e mobile capturados mas não validados funcionalmente. `test:e2e` 29/30 (falha só `/app/scale`).

---

## 4. Tarefas principais (o plano deve cobrir TUDO)

1. **Eliminar tudo que está em beta** — tornar produção-ready UI/UX, funcionalidades, PVA e PDFs.
2. **SPED/EFD:** usar o **`SpedEFD.exe`** para validar o arquivo gerado e **corrigir o gerador/preenchedor até o arquivo ser aceito (0 erros)** pela RFB.
3. **UI/UX:** melhorias com base nos 273 prints (consistência, estados vazios/erro/loading, responsivo, contraste, a11y).
4. **Funcionalidades:** tirar as páginas F10–F17 do estado mock para algo coerente (ou removê-las com honestidade); completar obrigações faltantes; melhorar PDFs.
5. **Infra/RLS/Cloud:** decidir e implementar se haverá cloud real (Supabase + RLS em runtime) ou se permanece local_prototype com banners honestos.
6. **PDFs da Receita Federal:** fornecer **links oficiais exatos** (Guia Prático SPED Fiscal, leiautes EFD ICMS/IPI, manual do PVA, catálogo de registros) que corrijam cada item, para o opencode buscar e aplicar.

---

## 5. SpedEFD.exe — validação oficial (tarefa central)

- **Caminho:** `C:\Arquivos de Programas RFB\Programas SPED\Fiscal\SpedEFD.exe`
- **Versão esperada:** PVA **6.1.0** (06/2026, perfil A). Usar **Guia Prático 3.2.2** (a 3.2.3 só vale a partir de 01/2027).
- **Arquivo a validar:** o EFD gerado pelo app — começar por `private-exports/probe-efd-fix/efd.txt` (ou o output do gerador em `src/modules/obligations/efd-icms-ipi/*`).
- **Objetivo:** rodar o validador, capturar **erros e advertências**, e corrigir o gerador/e preenchedor de registros até o arquivo ser aceito (0 erros).
- **Nota de execução:** o opencode tem acesso ao exe e ao disco. O plano deve incluir o **comando exato** (se o `SpedEFD.exe` suportar linha de comando — pesquise a sintaxe; ex.: modo texto/silent) **ou** o procedimento GUI passo a passo. Se não houver CLI, o opencode sinalizará e proporá automação ou bloqueio. Não invente sintaxe que não foi confirmada.

---

## 6. Formato de saída esperado (MODO PLANO)

Entregue:

1. **Diagnóstico** — resumo do que está beta (com base nos prints + estado + seção 3).
2. **Plano numerado**, dividido em seções:
   - **(A) PVA / SPED + SpedEFD.exe** — correção dos 2 erros, validação oficial, geração de "Generation 2" aceita.
   - **(B) UI/UX** — melhorias priorizadas com base nos prints (cada item cita rota/componente).
   - **(C) Funcionalidades** — F10–F17, obrigações faltantes, PDFs.
   - **(D) PDFs / Relatórios** — geração e melhoria, com links RFB.
   - **(E) Infra / RLS / Cloud** — decisão local_prototype vs cloud real + RLS em runtime.
   - Cada item deve conter: **arquivo(s) a criar/modificar** (caminho real), **comando(s)**, e **link(s) oficial(is) da RFB** de referência.
3. **Lista de perguntas / dados faltantes** — ex.: o relatório detalhado dos 2 erros PVA, se haverá cloud real, etc.

---

## 7. Mapa de arquivos-chave (para o plano acertar os caminhos)

- UX/design: `src/components/design-system/*`, `src/components/ui/*`, `src/components/layout/app-topbar.tsx`, `src/components/layout/app-sidebar.tsx`
- Rotas capturadas (11): `src/app/login`, `src/app/signup`, `src/app/forgot-password`, `src/app/app` (+ `upload`, `reconciliation`, `closing`, `batches`, `companies`, `billing`, `settings`)
- PVA/EFD: `src/app/app/obligations/efd-icms-ipi/pva/page.tsx`, `src/modules/obligations/efd-icms-ipi/verification-types.ts`, `src/modules/obligations/efd-icms-ipi/prevalidate.ts`, `supabase/migrations/202607150001_pva_field_definitions.sql`
- Scale (bug): `src/app/app/scale/page.tsx`, `src/modules/scale/*`
- Guardas: `e2e/visual/visual.spec.ts`, `playwright.visual.config.ts`, `tests/rls/real-rls.test.ts`, `vitest.rls.config.ts`
- Scripts: `scripts/screenshots-all.mjs`, `scripts/seed-demo.mjs`
- Docs: `docs/REPORT_2026-06.md`, `docs/NORMATIVE_REGISTRY.md`, `docs/CLOUD_STATUS_2026-06.md`, `docs/FISCAL_GUARDRAILS.md`, `docs/pva/2026-06/*`
- Prints (anexo): `artifacts/ui-capture/after/` (273 PNGs) + `contact-sheet.html`, `index.html`, `axe-report.json`

---

## 8. Restrições / convenções que o opencode seguirá

- Não inventar correções de PVA sem o relatório detalhado (manter `pva_rejected` honesto até ter os dados).
- Não falsear status de conformidade (SOC2, cloud, oficial) — banners honestos até virar real.
- Usar **Guia Prático 3.2.2** para 06/2026 (3.2.3 só ≥01/2027); PVA 6.1.0.
- Rodar `lint`, `typecheck`, `test`, `test:visual`, `build` antes de qualquer deploy.
- O usuário **autorizou deploy na Vercel**; o opencode publica em preview (e produção se confirmado).

---

## 9. Anexos que acompanham este prompt (zip de prints)

- `after-screenshots.zip` → contém `artifacts/ui-capture/after/` (273 prints: chromium/firefox/webkit × desktop/mobile/tablet × empty/populated/error/restricted) + `contact-sheet.html`, `index.html`, `axe-report.json`.
- Recomenda-se também anexar/confirmar: `docs/REPORT_2026-06.md`, `docs/NORMATIVE_REGISTRY.md`, `docs/pva/2026-06/*`, `AGENTS.md`.

---

**Agora, por favor, entregue o PLANO em modo plano, o mais completo e acionável possível, com os links oficiais da Receita Federal que o opencode deve usar para corrigir e aperfeiçoar o sistema.**
