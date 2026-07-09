# API

## Implemented (MVP)

- `GET /api/batches` (if present)
- `GET /api/batches/:id`
- `POST /api/batches/import` (metadata sync)

Primary data path remains **IndexedDB** in the browser.

## Contract draft

See `docs/openapi.yaml`.

## Planned

`/api/documents`, `/api/search`, `/api/audit`, `/api/exports`, `/api/sped`, `/api/rules`, `/api/relationships`, `/api/analytics`, `/api/webhooks`.
