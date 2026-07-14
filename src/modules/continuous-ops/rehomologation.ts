/**
 * Rotina de re-homologação — expiração de evidências + export §28.
 */

import type { ValidatedScenario } from "@/modules/homologation/types";
import type { RehomologationCheck } from "@/modules/continuous-ops/types";

const DEFAULT_MAX_AGE_DAYS = 90;

export function evidenceAgeDays(isoDate: string, now = new Date()): number {
  const t = Date.parse(isoDate);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - t) / (24 * 3600 * 1000));
}

export function nextQuarterlyDue(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth(); // 0-11
  const qEndMonth = Math.floor(m / 3) * 3 + 3; // 3,6,9,12
  if (qEndMonth >= 12) {
    return `${y + 1}-01-01`;
  }
  const mm = String(qEndMonth + 1).padStart(2, "0");
  return `${y}-${mm}-01`;
}

export function checkRehomologation(
  scn: ValidatedScenario,
  opts?: { maxAgeDays?: number; now?: Date },
): RehomologationCheck {
  const maxAge = opts?.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const anchor = scn.reviewedAt || scn.updatedAt;
  const age = evidenceAgeDays(anchor, opts?.now);
  const expired = age > maxAge;
  return {
    scenarioId: scn.id,
    evidenceAgeDays: age,
    expired,
    nextDue: nextQuarterlyDue(opts?.now),
    action: expired
      ? "retest_lab"
      : scn.status === "validated_scope_ready"
        ? "export_section28"
        : "ok",
  };
}

export function exportSection28Pack(scn: ValidatedScenario): {
  markdown: string;
  filename: string;
} {
  const md = [
    `# Pacote §28 — ${scn.obligationId}`,
    "",
    `- scenarioId: ${scn.id}`,
    `- period: ${scn.periodKey}`,
    `- uf: ${scn.uf || "—"}`,
    `- regime: ${scn.regime || "—"}`,
    `- layout: ${scn.layoutVersion}`,
    `- program: ${scn.program} ${scn.programVersion || ""}`,
    `- contentHash: ${scn.contentHash || "—"}`,
    `- homologationGrade: ${scn.homologationGrade}`,
    `- status: ${scn.status}`,
    `- cellTarget: ${scn.cellMaturityTarget}`,
    `- reviewer: ${scn.reviewerId || "—"} @ ${scn.reviewedAt || "—"}`,
    "",
    "## Notas",
    scn.section28Notes || "(sem notas)",
    "",
    "## Aviso",
    "Este pacote não declara produção global do produto.",
    "",
  ].join("\n");
  return {
    markdown: md,
    filename: `section28_${scn.obligationId}_${scn.periodKey}.md`,
  };
}
