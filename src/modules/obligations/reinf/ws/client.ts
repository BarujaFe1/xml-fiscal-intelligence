/**
 * Official WS client skeleton — FEATURE_REINF_SUBMIT must be true.
 * Default environment = restricted. Production submit requires extra flag.
 */

import type { ReinfCanonicalEvent, ReinfEnvironment } from "@/modules/obligations/reinf/lifecycle";

export type ReinfSubmitResult = {
  ok: boolean;
  protocolo?: string;
  recibo?: string;
  mensagem: string;
  environment: ReinfEnvironment;
  dryRun: boolean;
};

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export function isReinfSubmitEnabled(): boolean {
  return envBool("FEATURE_REINF_SUBMIT", false);
}

export function isReinfProductionSubmitEnabled(): boolean {
  return isReinfSubmitEnabled() && envBool("FEATURE_REINF_SUBMIT_PRODUCTION", false);
}

export function resolveReinfEnvironment(requested?: ReinfEnvironment): ReinfEnvironment {
  if (requested === "production" && isReinfProductionSubmitEnabled()) return "production";
  return "restricted";
}

/**
 * Submit signed event. Without FEATURE_REINF_SUBMIT returns dry-run refusal.
 * Real HTTP endpoints wire here only after official URL + auth review.
 */
export async function submitReinfEvent(
  event: Pick<ReinfCanonicalEvent, "id" | "xmlSigned" | "idempotencyKey" | "eventCode">,
  opts?: { environment?: ReinfEnvironment; timeoutMs?: number },
): Promise<ReinfSubmitResult> {
  const environment = resolveReinfEnvironment(opts?.environment);
  if (!event.xmlSigned) {
    return {
      ok: false,
      mensagem: "XML assinado ausente — use agente local",
      environment,
      dryRun: true,
    };
  }
  if (!isReinfSubmitEnabled()) {
    return {
      ok: false,
      mensagem:
        "FEATURE_REINF_SUBMIT=false — submit desligado. Nenhum HTTP ao ambiente oficial.",
      environment,
      dryRun: true,
    };
  }
  if (environment === "production" && !isReinfProductionSubmitEnabled()) {
    return {
      ok: false,
      mensagem: "Produção bloqueada — FEATURE_REINF_SUBMIT_PRODUCTION necessário",
      environment: "restricted",
      dryRun: true,
    };
  }

  // Placeholder: no live call in Fase 3 without explicit endpoints + secrets review.
  void opts?.timeoutMs;
  return {
    ok: false,
    mensagem:
      `WS cliente preparado (idempotency=${event.idempotencyKey}) mas endpoint oficial ainda não acoplado nesta fase.`,
    environment,
    dryRun: true,
  };
}
