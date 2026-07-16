# UI Capture — `after/`

This directory is **generated** by the screenshot harness. Do not commit it by
hand.

## Structure

```
artifacts/ui-capture/after/
  manifest.json        # routes, viewports, engines, states, Axe summary
  axe-report.json      # per-shot Axe results (critical/serious/moderate)
  index.html           # gallery + Axe summary
  contact-sheet.html   # thumbnail grid of every captured shot
  <engine>_<viewport>_<state>_<route>.png   # per-route PNGs
```

## How it is generated

Run the app first (the harness does **not** start a server):

```bash
npm run start          # or: npm run dev
npm run seed:demo      # optional: deterministic synthetic seed data
npm run screenshots:all
```

`BASE_URL` defaults to `http://localhost:3000` and can be overridden:

```bash
BASE_URL=https://staging.example.com npm run screenshots:all
```

The harness captures the 11 captured routes across **chromium / firefox /
webkit** at **desktop (1280×800) / tablet (820×1180) / mobile (390×844)** for
states: `empty`, `populated` (best-effort, assumes `private-test-data/seed`),
`error` (best-effort forced-error navigation), and `restricted` (logged-out
navigation to `/app` routes to surface redirect/403).

If a browser engine is not installed, that engine is skipped with a warning and
the run continues with the others — the harness never fabricates screenshots.

## Visual + a11y guard (Playwright test)

```bash
npm run test:visual    # runs e2e/visual/visual.spec.ts via playwright.visual.config.ts
```

The spec loads each of the 11 routes on chromium desktop, asserts a `main`
landmark and an `h1` exist, and fails on any critical/serious Axe violation. It
skips gracefully when `BASE_URL` is unreachable.

> Note: in environments where Playwright browsers are not installed, the
> capture and the visual test are expected to be blocked. Install browsers with
> `npx playwright install` before running.
