# Observability

Safe logging facade: `src/lib/observability/index.ts`.

## Principles

- Always attach `requestId` / `correlationId` when available.
- Never log raw XML, passwords, tokens, certificates, or full access keys.
- `sanitizeLogMessage` redacts 44-digit keys and Bearer tokens.
- Workspace IDs are truncated in sink output.

## Endpoints

| Route | Purpose |
| ----- | ------- |
| `GET /api/health` | Liveness + light config hints |
| `GET /api/ready` | Readiness / commercialReady checks |

## Extending

Call `setObservabilitySink` once at bootstrap to forward to Sentry or OpenTelemetry without changing call sites.
