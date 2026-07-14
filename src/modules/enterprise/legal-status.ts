/**
 * Status legal/comercial honesto — DPA/SLA/certificações.
 */

import type { LegalCommercialStatus } from "@/modules/enterprise/types";

export function defaultLegalStatus(): LegalCommercialStatus {
  return {
    dpa: "template_only",
    sla: "draft",
    soc2Certified: false,
    iso27001Certified: false,
    notes: [
      "DPA: ver docs/DPA_TEMPLATE.md — não assinado",
      "SLA: ver docs/SLA.md — draft ≠ commercially_bound",
      "Certificações: preparação apenas (control matrix + binder)",
    ],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Só permite marcar DPA signed / SLA bound com flags explícitas de processo.
 * Nunca inventa assinatura.
 */
export function applyLegalMilestones(
  current: LegalCommercialStatus,
  patch: {
    dpaSignedEvidenceRef?: string;
    slaBoundEvidenceRef?: string;
  },
): LegalCommercialStatus {
  const next = { ...current, notes: [...current.notes], updatedAt: new Date().toISOString() };
  if (patch.dpaSignedEvidenceRef?.trim()) {
    next.dpa = "signed";
    next.notes.push(`DPA signed evidence: ${patch.dpaSignedEvidenceRef.trim()}`);
  }
  if (patch.slaBoundEvidenceRef?.trim()) {
    next.sla = "commercially_bound";
    next.notes.push(`SLA bound evidence: ${patch.slaBoundEvidenceRef.trim()}`);
  }
  next.soc2Certified = false;
  next.iso27001Certified = false;
  return next;
}

export function assertNoFakeCertification(status: LegalCommercialStatus): void {
  if (status.soc2Certified) throw new Error("soc2Certified inválido sem auditoria externa");
  if (status.iso27001Certified) throw new Error("iso27001Certified inválido sem auditoria externa");
}
