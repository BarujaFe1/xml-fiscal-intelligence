/** OpenAPI 3.0 fragment for /api/v1 (Fase 7). */

export const OPS_OPENAPI_V1 = {
  openapi: "3.0.3",
  info: {
    title: "XML Fiscal Intelligence Ops API",
    version: "1.5.0-phase16",
    description:
      "Plataforma operacional. API keys via X-Api-Key. Sem endpoints de transmissão Reinf. Não eleva maturidade de obrigações. Inclui growth.guidedAssistEnabled + mobileReadOnly (F16).",
  },
  servers: [{ url: "/api/v1" }],
  "x-rate-limits": {
    apiKeyDefault: {
      maxRequestsPerHour: 300,
      notes: "Espelha QuotaPolicy.maxApiCallsPerHour do continuous-ops; 429 quando excedido",
    },
    generations: {
      maxPerHour: 60,
      notes: "QuotaPolicy.maxGenerationsPerHour — gerações assistidas",
    },
    notifications: {
      maxPerHour: "NotificationPrefs.maxPerHour",
      notes: "Canal webhook/email sanitizado",
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "X-Api-Key" },
    },
    responses: {
      TooManyRequests: {
        description: "429 — quota/rate limit excedido",
        headers: {
          "Retry-After": {
            schema: { type: "integer" },
            description: "Segundos até o próximo hourBucket",
          },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/openapi.json": {
      get: {
        summary: "Este documento OpenAPI",
        security: [],
        responses: { "200": { description: "OpenAPI JSON" } },
      },
    },
    "/status": {
      get: {
        summary:
          "Status ops + scale + ecosystem.stagingApiSlo + compliance.packHashOk",
        responses: {
          "200": {
            description:
              "Status (SLO staging samples; compliance pack fingerprint — sem selo SOC2)",
          },
          "401": { description: "Unauthorized" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/obligations": {
      get: {
        summary: "Lista obrigações e maturidade real",
        responses: {
          "200": { description: "Lista" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/evidence": {
      get: {
        summary: "Metadata de evidências (sem binários)",
        parameters: [
          { name: "workspaceId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Lista metadata" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
      post: {
        summary: "Registra metadata de evidência",
        parameters: [
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        responses: {
          "201": { description: "Criado" },
          "400": { description: "Payload inválido" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/commercial-matrix": {
      get: {
        summary: "Matriz comercial espelhando maturidade real",
        responses: {
          "200": { description: "Matriz" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
  },
} as const;
