/**
 * Control matrix — mapeamento honesto para famílias SOC2 (sem claim de certificação).
 */

import type { ControlMapping } from "@/modules/enterprise/types";

export const CONTROL_MATRIX: ControlMapping[] = [
  {
    id: "ctl_rbac",
    title: "RBAC workspace (owner/preparer/approver/auditor)",
    soc2Hints: ["CC6", "CC1"],
    evidenceRefs: ["src/modules/governance/rbac.ts", "/app/governance"],
    status: "implemented",
  },
  {
    id: "ctl_sod",
    title: "SoD preparer ≠ approver + transmit gates",
    soc2Hints: ["CC6", "CC8"],
    evidenceRefs: ["src/modules/ops/sod.ts", "src/modules/homologation/transmission.ts"],
    status: "implemented",
  },
  {
    id: "ctl_audit_export",
    title: "Export trilha auditoria sanitizada",
    soc2Hints: ["CC7", "CC2"],
    evidenceRefs: ["src/modules/governance/audit-export.ts"],
    status: "implemented",
  },
  {
    id: "ctl_retention",
    title: "Políticas de retenção versionadas",
    soc2Hints: ["C1", "A1"],
    evidenceRefs: ["src/modules/governance/retention.ts"],
    status: "implemented",
    gapNotes: "Defaults operacionais ≠ parecer jurídico LGPD",
  },
  {
    id: "ctl_secrets",
    title: "Secrets fora do git + path scan",
    soc2Hints: ["CC6", "CC7"],
    evidenceRefs: ["scripts/check-secret-paths.mjs", "src/modules/governance/secrets-guard.ts"],
    status: "partial",
    gapNotes: "Sem secrets manager enterprise completo / rotação automática",
  },
  {
    id: "ctl_rls",
    title: "RLS Supabase por workspace member",
    soc2Hints: ["CC6"],
    evidenceRefs: ["supabase/migrations/*"],
    status: "partial",
    gapNotes: "Cobertura depende de migrations aplicadas no projeto linkado",
  },
  {
    id: "ctl_live_erp_gate",
    title: "Deny live ERP sem XFI_ALLOW_LIVE_ERP",
    soc2Hints: ["CC6", "CC8"],
    evidenceRefs: ["src/modules/enterprise/erp-live-pilot.ts"],
    status: "implemented",
  },
  {
    id: "ctl_marketplace_relab",
    title: "Import marketplace força re-lab",
    soc2Hints: ["CC8", "PI1"],
    evidenceRefs: ["src/modules/enterprise/marketplace.ts"],
    status: "implemented",
  },
  {
    id: "ctl_dr_multi_region",
    title: "DR / multi-região",
    soc2Hints: ["A1"],
    evidenceRefs: [],
    status: "planned",
    gapNotes: "Fase 13",
  },
  {
    id: "ctl_external_audit",
    title: "Auditoria SOC2/ISO externa",
    soc2Hints: ["CC1"],
    evidenceRefs: ["docs/CERTIFICATION_GAP_ANALYSIS.md"],
    status: "out_of_scope",
    gapNotes: "Exige auditor contratado — produto só prepara evidências",
  },
];

export function controlMatrixMarkdown(matrix: ControlMapping[] = CONTROL_MATRIX): string {
  const lines = [
    "# Control matrix (preparação SOC2 — sem certificação)",
    "",
    "| id | status | SOC2 hints | evidência |",
    "|----|--------|------------|-----------|",
  ];
  for (const c of matrix) {
    lines.push(
      `| ${c.id} | ${c.status} | ${c.soc2Hints.join(",")} | ${c.evidenceRefs.join("; ") || "—"} |`,
    );
  }
  lines.push("", "## Gaps");
  for (const c of matrix.filter((x) => x.gapNotes)) {
    lines.push(`- **${c.id}**: ${c.gapNotes}`);
  }
  return lines.join("\n");
}

export function controlMatrixSummary(matrix: ControlMapping[] = CONTROL_MATRIX): {
  implemented: number;
  partial: number;
  planned: number;
  outOfScope: number;
} {
  return {
    implemented: matrix.filter((c) => c.status === "implemented").length,
    partial: matrix.filter((c) => c.status === "partial").length,
    planned: matrix.filter((c) => c.status === "planned").length,
    outOfScope: matrix.filter((c) => c.status === "out_of_scope").length,
  };
}
