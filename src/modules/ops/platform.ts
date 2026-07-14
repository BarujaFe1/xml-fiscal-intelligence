/**
 * Maturidade da plataforma ops (não sobe obrigação individual).
 */

import type { PlatformMaturity } from "@/modules/ops/types";

export const PLATFORM_OPS_MATURITY: PlatformMaturity = "internal_beta";

export const PLATFORM_OPS_CAPABILITIES = [
  "calendário descritivo com sourceId (sem datas inventadas)",
  "tarefas + SoD preparador≠aprovador",
  "gerações imutáveis + retificação/diff",
  "cofre evidências (metadata)",
  "notificações sanitizadas + rate limit",
  "API /api/v1 OpenAPI + API keys",
  "ERP CSV/JSON genérico (preview/idempotência)",
  "catálogo regulatório identified→published",
  "matriz comercial espelhando maturidade real",
] as const;
