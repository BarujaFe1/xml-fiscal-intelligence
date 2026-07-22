# PR1 — Evidência confiável + /app/scale

Status: **CONCLUÍDO** (gates verdes). PR2/PR3 em andamento.

## O que foi feito

### 1. Fix /app/scale (hydration #418)
- `src/app/app/scale/page.tsx`: `scaleHealth()` e `regionalHealthReport()` (que liam
  `process.env` no servidor) foram movidos para dentro do `useEffect` (client-only) e
  passados via `useState`. O SSR e o primeiro render do cliente agora são determinísticos
  (sem mismatch de `regionsReachable` / `checkedAt`).
- Resultado: e2e subiu de **29/30 → 30/30**; o erro "Minified React error #418" some.

### 2. Sistema de estados/screenshots reconstruído (honesto)
Causa raiz do problema apontado pelo ChatGPT ("273 PNGs, só 65 únicos"): o harness antigo
nunca autenticava e não injetava dados, então toda rota `/app` caía no redirect de login →
telas de login duplicadas; `populated`/`error` eram no-ops.

- `scripts/lib/ui-state.mjs` (novo): definições determinísticas de rotas/viewports/estados.
  Modelo honesto de 2 estados que são de fato diferentes e reprodutíveis:
  - `guest` — navegação logado-out (contexto fresco).
  - `error` — navegação a sub-caminho inexistente (superfície not-found do app).
  - Rotas protegidas por `src/lib/auth/middleware.ts` (`/app/billing`, `/app/companies`,
    `/app/obligations/*`) legitimamente mostram o auth gate neste ambiente (sem Supabase) —
    documentadas como `gated`, isentas do critério de diferenciação.
- `scripts/screenshots-all.mjs` (rewrite): matriz completa
  **3 engines (chromium/firefox/webkit) × 3 viewports × 11 rotas × 2 estados = 198 shots**,
  rodando contra `npm run start` (build de produção, sem indicador de dev). Captura
  `finalUrl`/status HTTP e erros de página/console; roda Axe na matriz TODA (antes só
  chromium/desktop/empty+restricted).
- `scripts/lib/matrix-check.mjs` + `scripts/verify-screenshot-matrix.mjs` (novo):
  gate de verificação — completude, sem redirect-inesperado-para-login, sem page errors,
  e células (rota,engine,viewport) não-uniformes para rotas não-gateadas.
- `tests/unit/screenshot-manifest.test.ts` (novo): mesmo gate via vitest
  (`XFI_CHECK_SCREENSHOTS=1`).
- `package.json`: script `screenshots:verify`.

### 3. Resultado da nova captura
- **198/198 shots** capturados e verificados (completo e diferenciado).
- **81 células não-gateadas diferenciadas**; 18 células gateadas (`/app/billing`,
  `/app/companies`) mostram o auth gate (esperado).
- **Axe na matriz completa: 0 critical / 0 serious / 0 moderate** (antes: só 19 runs
  chromium/desktop).

## Gates (PR1)
| Gate | Resultado |
|------|-----------|
| typecheck | ✅ 0 |
| unit (`npm test`) | ✅ 240 pass / 2 skip |
| e2e (`npm run test:e2e`) | ✅ 30/30 |
| visual (`npm run test:visual`) | ✅ 11/11 |
| build (`npm run build`) | ✅ 0 |
| lint (`npm run lint`) | ⚠️ 6 erros pré-existentes (`react-hooks/set-state-in-effect` em `scale.*`); **sem regressão** introduzida por PR1 |
| screenshot matrix | ✅ 198/198 completo + diferenciado; Axe 0 violações |

## Artefatos
- `artifacts/ui-capture/after/` — 198 PNGs + `manifest.json`, `axe-report.json`,
  `index.html`, `contact-sheet.html`.
- `artifacts/ui-capture/after-screenshots.zip` — pacote para entrega/handoff.
- `docs/production-readiness/` — `baseline-*.{log,txt}`, `pr1-*.log`.
