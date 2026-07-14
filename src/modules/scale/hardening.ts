/**
 * Hardening pós-auditoria — secrets manager modo + triage pen-test.
 */

import type { PenTestFinding, SecretsManagerMode } from "@/modules/scale/types";

export function resolveSecretsManagerMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SecretsManagerMode {
  if (env.XFI_SECRETS_MANAGER_URL?.trim()) return "external_configured";
  if (env.XFI_SECRETS_MANAGER === "1" || env.XFI_SECRETS_MANAGER === "planned") {
    return "external_planned";
  }
  return "env_only";
}

export function secretsManagerStatusMarkdown(mode: SecretsManagerMode): string {
  return [
    "# Secrets manager",
    "",
    `Modo atual: \`${mode}\``,
    "",
    "- env_only: variables de processo (default Fase 13)",
    "- external_planned: integração vault documentada, ainda não ligada",
    "- external_configured: XFI_SECRETS_MANAGER_URL presente",
    "",
    "Nunca gravar secrets no git.",
  ].join("\n");
}

export function createPenTestFinding(input: {
  title: string;
  severity: PenTestFinding["severity"];
  residualRisk?: string;
}): PenTestFinding {
  return {
    id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: input.title,
    severity: input.severity,
    status: "open",
    residualRisk: input.residualRisk,
    updatedAt: new Date().toISOString(),
  };
}

export function triageFinding(
  finding: PenTestFinding,
  status: PenTestFinding["status"],
  residualRisk?: string,
): PenTestFinding {
  return {
    ...finding,
    status,
    residualRisk: residualRisk ?? finding.residualRisk,
    updatedAt: new Date().toISOString(),
  };
}

export function residualRisksMarkdown(findings: PenTestFinding[]): string {
  const open = findings.filter((f) => f.status === "open" || f.status === "accepted");
  const lines = ["# Residual risks (pen-test triage)", ""];
  if (!open.length) {
    lines.push("_Nenhum finding open/accepted._");
    return lines.join("\n");
  }
  for (const f of open) {
    lines.push(`- **${f.severity}** [${f.status}] ${f.title}${f.residualRisk ? ` — ${f.residualRisk}` : ""}`);
  }
  return lines.join("\n");
}
