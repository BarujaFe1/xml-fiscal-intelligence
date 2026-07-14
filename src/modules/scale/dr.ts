/**
 * DR targets + drills — draft operacional, sem claim de cobertura RFB.
 */

import type { DrDrillRecord, DrTargets } from "@/modules/scale/types";

export function defaultDrTargets(): DrTargets {
  return {
    rpoHours: 24,
    rtoHours: 72,
    outOfScope: [
      "Disponibilidade PVA / PGE / Programas ECD·ECF",
      "Ambiente EFD-Reinf / DCTFWeb da RFB",
      "IndexedDB do browser do usuário (backup = cliente)",
      "Secrets em estações locais sem vault",
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function drTargetsMarkdown(t: DrTargets = defaultDrTargets()): string {
  return [
    "# DR targets (draft)",
    "",
    `- RPO: ${t.rpoHours}h`,
    `- RTO: ${t.rtoHours}h`,
    "",
    "## Fora de cobertura",
    ...t.outOfScope.map((x) => `- ${x}`),
    "",
    "_Draft operacional — não é SLA comercial bound._",
  ].join("\n");
}

export function createDrDrill(input: {
  regionId: string;
  environment?: DrDrillRecord["environment"];
  notes: string;
}): DrDrillRecord {
  const environment = input.environment || "staging";
  return {
    id: `drill_${Date.now()}`,
    regionId: input.regionId,
    environment,
    status: "planned",
    notes: input.notes,
    countsAsEvidence: false,
  };
}

/** Executa drill — production_claimed nunca conta como evidência automática. */
export function executeDrDrill(
  drill: DrDrillRecord,
  result: "executed" | "failed",
  notes?: string,
): DrDrillRecord {
  const executedAt = new Date().toISOString();
  const countsAsEvidence = result === "executed" && drill.environment === "staging";
  return {
    ...drill,
    status: result,
    executedAt,
    notes: notes ? `${drill.notes} | ${notes}` : drill.notes,
    countsAsEvidence,
  };
}

export function backupRestoreProcedureMarkdown(): string {
  return [
    "# Backup / restore procedure (staging)",
    "",
    "1. Export evidence binder + audit CSV (governança/enterprise).",
    "2. Snapshot Supabase (plano com PITR) ou `pg_dump` staging.",
    "3. Listar Blob refs (migrate) — restaurar objetos por ref.",
    "4. Re-hidratar IDB via `/app/migrate` no browser piloto.",
    "5. Registrar drill com `executeDrDrill` (environment=staging).",
    "6. Re-lab cenários críticos (marketplace import força lab_pending).",
    "",
    "## Não cobre",
    "- PVA/RFB outage",
    "- Dados só no browser sem migrate",
    "",
  ].join("\n");
}
