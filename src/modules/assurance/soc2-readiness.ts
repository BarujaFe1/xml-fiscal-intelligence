/**
 * SOC2 Type I prep — readiness checklist + SoA draft (sem emitir relatório).
 */

import type {
  Soc2ReadinessItem,
  StatementOfApplicabilityRow,
} from "@/modules/assurance/types";
import { CONTROL_MATRIX } from "@/modules/enterprise/controls";
import { resolveSecretsManagerMode } from "@/modules/scale/hardening";
import { defaultLegalStatus } from "@/modules/enterprise/legal-status";
import { preAuditChecklist } from "@/modules/compliance/pack";

export function soc2ReadinessChecklist(input?: {
  hasStagingDrDrillEvidence?: boolean;
  secretsMode?: ReturnType<typeof resolveSecretsManagerMode>;
}): Soc2ReadinessItem[] {
  const legal = defaultLegalStatus();
  const secrets = input?.secretsMode ?? resolveSecretsManagerMode();
  const pre = preAuditChecklist();
  const preById = new Map(pre.map((p) => [p.id, p]));

  return [
    {
      id: "controls_matrix",
      title: "Control matrix revisada",
      status: "done",
      evidenceRef: "src/modules/enterprise/controls.ts",
    },
    {
      id: "evidence_binder",
      title: "Evidence binder exportável",
      status: "done",
      evidenceRef: "src/modules/enterprise/evidence-binder.ts",
    },
    {
      id: "compliance_pack",
      title: "Compliance pack versionado + hash",
      status: "done",
      evidenceRef: "src/modules/compliance/pack.ts",
    },
    {
      id: "dr_drill",
      title: "DR drill staging com countsAsEvidence",
      status: input?.hasStagingDrDrillEvidence ? "done" : "waived",
      evidenceRef: "docs/DR_RUNBOOK.md · /app/scale",
      waiverRationale: input?.hasStagingDrDrillEvidence
        ? undefined
        : "Procedimento pronto em /app/scale; waiver até drill staging com evidenceRef gravado na janela de auditoria",
    },
    {
      id: "dpa_status",
      title: "DPA além de template_only",
      status: legal.dpa === "template_only" ? "waived" : "done",
      waiverRationale:
        legal.dpa === "template_only"
          ? "Aguardando jurídico — template documentado em docs/DPA_TEMPLATE.md"
          : undefined,
      evidenceRef: `dpa=${legal.dpa}`,
    },
    {
      id: "sla_status",
      title: "SLA draft revisado",
      status: legal.sla === "draft" ? "waived" : "done",
      waiverRationale:
        legal.sla === "draft" ? "SLA draft em docs/SLA.md — commercially_bound exige evidence" : undefined,
    },
    {
      id: "secrets_manager",
      title: "Secrets manager path documentado",
      status: secrets === "env_only" ? "waived" : "done",
      waiverRationale:
        secrets === "env_only"
          ? "Modo env_only aceitável pré-Type I; planejar Vault (XFI_SECRETS_MANAGER_URL)"
          : undefined,
      evidenceRef: `mode=${secrets}`,
    },
    {
      id: "slo_samples",
      title: "SLO api_status amostrado (staging)",
      status: preById.get("slo")?.done ? "done" : "waived",
      evidenceRef: "src/modules/ecosystem/slo.ts",
      waiverRationale: preById.get("slo")?.done
        ? undefined
        : "Seed staging disponível; samples reais de prod fora do escopo Type I prep",
    },
    {
      id: "no_fake_soc2",
      title: "Marketing sem claim SOC2 sem relatório externo",
      status: "done",
      evidenceRef: "legal.soc2Certified=false enforced",
    },
    {
      id: "rls_migrations",
      title: "RLS migrations no repositório",
      status: "done",
      evidenceRef: "supabase/migrations/*",
    },
  ];
}

export function readinessSummary(items: Soc2ReadinessItem[] = soc2ReadinessChecklist()): {
  total: number;
  done: number;
  waived: number;
  open: number;
  completeOrWaived: boolean;
} {
  const done = items.filter((i) => i.status === "done").length;
  const waived = items.filter((i) => i.status === "waived").length;
  const open = items.filter((i) => i.status === "open").length;
  return {
    total: items.length,
    done,
    waived,
    open,
    completeOrWaived: open === 0,
  };
}

export function statementOfApplicabilityDraft(): StatementOfApplicabilityRow[] {
  return CONTROL_MATRIX.map((c) => ({
    controlId: c.id,
    applicable: c.status !== "out_of_scope",
    implemented: c.status === "implemented" || c.status === "partial",
    notes:
      c.status === "out_of_scope"
        ? c.gapNotes || "out of scope até auditor externo"
        : c.gapNotes || c.title,
  }));
}

export function soaMarkdown(rows: StatementOfApplicabilityRow[] = statementOfApplicabilityDraft()): string {
  const lines = [
    "# Statement of Applicability (draft)",
    "",
    "_Não é relatório SOC2 Type I. Preparação interna apenas._",
    "",
    "| control | applicable | implemented | notes |",
    "|---------|------------|-------------|-------|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.controlId} | ${r.applicable} | ${r.implemented} | ${r.notes.replace(/\|/g, "/")} |`,
    );
  }
  return lines.join("\n");
}

export function readinessMarkdown(items: Soc2ReadinessItem[] = soc2ReadinessChecklist()): string {
  const s = readinessSummary(items);
  const lines = [
    "# SOC2 Type I — readiness interno",
    "",
    `done=${s.done} waived=${s.waived} open=${s.open} · completeOrWaived=${s.completeOrWaived}`,
    "",
  ];
  for (const i of items) {
    lines.push(
      `- **${i.status}** ${i.id}: ${i.title}${i.waiverRationale ? ` — _waiver:_ ${i.waiverRationale}` : ""}`,
    );
  }
  lines.push("", "Produto **não** emite relatório SOC2 sem auditor externo.");
  return lines.join("\n");
}
