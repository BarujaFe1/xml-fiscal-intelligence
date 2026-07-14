/**
 * LGPD — data map + privacy requests (export/erase) honestos.
 */

import type {
  DataMapEntry,
  PrivacyRequest,
  PrivacyRequestStatus,
  PrivacyRequestType,
} from "@/modules/compliance/types";

export const DATA_MAP: DataMapEntry[] = [
  {
    purpose: "xml_import",
    categories: ["XML fiscal", "metadados de lote", "CNPJ/IE em documentos"],
    retentionClass: "xml_batch",
    lawfulBasisHint: "execução de contrato / obrigação legal (cliente controlador)",
    sharedWithPartners: false,
    notes: ["Minimizar PII em logs", "IndexedDB = responsabilidade do dispositivo"],
  },
  {
    purpose: "obligation_generation",
    categories: ["gerações SPED/ECD/ECF", "contentHash", "periodKey"],
    retentionClass: "generation_meta",
    lawfulBasisHint: "execução de contrato",
    sharedWithPartners: false,
    notes: ["Sem claim de substituição dos programas oficiais"],
  },
  {
    purpose: "lab_evidence",
    categories: ["metadados de evidência PVA/PGE", "programVersion", "hashes"],
    retentionClass: "evidence",
    lawfulBasisHint: "obrigação legal / interesse legítimo do controlador",
    sharedWithPartners: false,
    notes: ["Binários RFB fora do git"],
  },
  {
    purpose: "partner_share",
    categories: ["cenários sanitizados", "convites", "papel partner_auditor"],
    retentionClass: "audit_trail",
    lawfulBasisHint: "consentimento / contrato com parceiro",
    sharedWithPartners: true,
    notes: ["Exige agreement template — ver partnerDsaTemplateMarkdown"],
  },
  {
    purpose: "billing_metering",
    categories: ["contadores gerações/API", "planId"],
    retentionClass: "audit_trail",
    lawfulBasisHint: "execução de contrato",
    sharedWithPartners: false,
    notes: ["Metering ≠ cobrança sem webhook"],
  },
  {
    purpose: "telemetry_ops",
    categories: ["eventos sanitizados", "SLO samples"],
    retentionClass: "audit_trail",
    lawfulBasisHint: "interesse legítimo (ops)",
    sharedWithPartners: false,
    notes: ["Sem XML/CNPJ completo em alertas"],
  },
  {
    purpose: "audit_trail",
    categories: ["ações SoD/RBAC", "API key audit"],
    retentionClass: "audit_trail",
    lawfulBasisHint: "obrigação legal / segurança",
    sharedWithPartners: false,
    notes: ["Export sanitizado disponível"],
  },
];

export function dataMapMarkdown(entries: DataMapEntry[] = DATA_MAP): string {
  const lines = [
    "# Data map (finalidades)",
    "",
    "_Hints operacionais — não substituem parecer jurídico LGPD._",
    "",
    "| purpose | retention | partners |",
    "|---------|-----------|----------|",
  ];
  for (const e of entries) {
    lines.push(
      `| ${e.purpose} | ${e.retentionClass} | ${e.sharedWithPartners ? "yes" : "no"} |`,
    );
  }
  return lines.join("\n");
}

export function createPrivacyRequest(input: {
  workspaceId: string;
  type: PrivacyRequestType;
  requesterId: string;
  notes?: string;
}): PrivacyRequest {
  const now = new Date().toISOString();
  return {
    id: `priv_${input.type}_${Date.now()}`,
    workspaceId: input.workspaceId,
    type: input.type,
    status: "received",
    requesterId: input.requesterId,
    notes: input.notes,
    cloudBackupOutOfScope: true,
    createdAt: now,
    updatedAt: now,
  };
}

const ALLOWED: Record<PrivacyRequestStatus, PrivacyRequestStatus[]> = {
  received: ["in_review", "cancelled", "rejected"],
  in_review: ["fulfilled_partial", "fulfilled", "rejected", "cancelled"],
  fulfilled_partial: ["fulfilled"],
  fulfilled: [],
  rejected: [],
  cancelled: [],
};

export function advancePrivacyRequest(
  req: PrivacyRequest,
  to: PrivacyRequestStatus,
  notes?: string,
): PrivacyRequest {
  if (!ALLOWED[req.status]?.includes(to)) {
    throw new Error(`transição inválida ${req.status} → ${to}`);
  }
  const now = new Date().toISOString();
  const next: PrivacyRequest = {
    ...req,
    status: to,
    notes: notes ? `${req.notes || ""} | ${notes}`.trim() : req.notes,
    updatedAt: now,
    cloudBackupOutOfScope: true,
  };
  if (to === "fulfilled" || to === "fulfilled_partial") {
    next.fulfilledAt = now;
  }
  return next;
}

/** Erase honesto: fulfilled_partial — backups cloud não são auto-apagados. */
export function fulfillEraseHonest(req: PrivacyRequest): PrivacyRequest {
  if (req.type !== "erase") throw new Error("não é erase");
  let next = advancePrivacyRequest(req, "in_review", "revisão erase");
  next = advancePrivacyRequest(
    next,
    "fulfilled_partial",
    "apagado/anonimizado no SoR operacional; backups cloud fora de escopo automático",
  );
  return next;
}

export function fulfillExport(req: PrivacyRequest): PrivacyRequest {
  if (req.type !== "export") throw new Error("não é export");
  let next = advancePrivacyRequest(req, "in_review", "montar export sanitizado");
  next = advancePrivacyRequest(next, "fulfilled", "export entregue (sanitizado)");
  return next;
}

export function partnerDsaTemplateMarkdown(): string {
  return [
    "# Partner data sharing agreement — template",
    "",
    "**Aviso:** esqueleto operacional — não é contrato assinado.",
    "",
    "## Partes",
    "- Controlador (cliente host workspace)",
    "- Parceiro contábil (`partner_auditor`)",
    "- Operador da plataforma",
    "",
    "## Dados compartilhados",
    "- Metadados de cenários / lotes conforme permissões RBAC",
    "- Sem XML completo por default em alertas",
    "- White-label preview sem claim de produção global",
    "",
    "## Obrigações do parceiro",
    "- Não transmitir obrigações do host",
    "- Não reexportar dados para terceiros sem base legal",
    "- Re-lab obrigatório em imports de marketplace",
    "",
    "## Assinaturas",
    "_Reservado ao jurídico._",
    "",
  ].join("\n");
}
