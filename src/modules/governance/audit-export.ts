/**
 * Export de trilha de auditoria — sem PII excessiva / sem XML.
 */

import type { ClosingTask, ImmutableGeneration, EvidenceMeta } from "@/modules/ops/types";
import type { NtInboxItem } from "@/modules/continuous-ops/types";
import type { OpsTelemetryEvent } from "@/modules/ops/telemetry";
import type { AuditExportRow } from "@/modules/governance/types";

const CNPJ_RE = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
const XML_TAG_RE = /<[^>]+>/g;

export function sanitizeAuditDetail(raw: string): string {
  return raw
    .replace(CNPJ_RE, "[CNPJ]")
    .replace(XML_TAG_RE, "[xml]")
    .replace(/\b\d{11}\b/g, "[CPF]")
    .slice(0, 400);
}

export function rowsFromClosingTasks(tasks: ClosingTask[]): AuditExportRow[] {
  const out: AuditExportRow[] = [];
  for (const t of tasks) {
    for (const a of t.audit) {
      out.push({
        source: "closing_task",
        at: a.at,
        actorId: a.actorId,
        action: a.action,
        detail: sanitizeAuditDetail(`${t.title} · ${t.obligationId} · ${a.note || ""}`),
        refId: t.id,
      });
    }
  }
  return out;
}

export function rowsFromGenerations(gens: ImmutableGeneration[]): AuditExportRow[] {
  return gens.map((g) => ({
    source: "generation" as const,
    at: g.createdAt,
    actorId: g.createdBy,
    action: g.locked ? "locked_generation" : "generation",
    detail: sanitizeAuditDetail(
      `${g.obligationId} v${g.version} hash=${g.contentHash.slice(0, 12)}…`,
    ),
    refId: g.id,
  }));
}

export function rowsFromEvidence(evs: EvidenceMeta[]): AuditExportRow[] {
  return evs.map((e) => ({
    source: "lab_evidence" as const,
    at: e.importedAt,
    actorId: e.responsible,
    action: `evidence_${e.resultStatus}`,
    detail: sanitizeAuditDetail(`${e.obligationId} ${e.program} ${e.notes || ""}`),
    refId: e.id,
  }));
}

export function rowsFromApiKeyAudit(
  events: Array<{ at: string; keyId?: string; action: string; detail?: string }>,
): AuditExportRow[] {
  return events.map((e) => ({
    source: "api_key" as const,
    at: e.at,
    action: e.action,
    detail: sanitizeAuditDetail(e.detail || e.keyId || ""),
    refId: e.keyId,
  }));
}

export function rowsFromNtInbox(items: NtInboxItem[]): AuditExportRow[] {
  return items.map((i) => ({
    source: "nt_inbox" as const,
    at: i.updatedAt,
    actorId: i.reviewerId,
    action: `nt_${i.status}`,
    detail: sanitizeAuditDetail(`${i.title} activated=${i.ruleSetActivated}`),
    refId: i.id,
  }));
}

export function rowsFromTelemetry(events: OpsTelemetryEvent[]): AuditExportRow[] {
  return events.map((e) => ({
    source: "telemetry" as const,
    at: e.at,
    action: e.kind,
    detail: sanitizeAuditDetail(e.detail),
    refId: e.id,
  }));
}

export function mergeAuditExport(rows: AuditExportRow[]): AuditExportRow[] {
  return [...rows].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function auditExportToCsv(rows: AuditExportRow[]): string {
  const header = "source,at,actorId,action,detail,refId";
  const lines = rows.map((r) =>
    [r.source, r.at, r.actorId || "", r.action, `"${r.detail.replace(/"/g, "'")}"`, r.refId || ""].join(
      ",",
    ),
  );
  return [header, ...lines].join("\n");
}

export function auditExportMarkdown(rows: AuditExportRow[]): string {
  const lines = [
    "# Audit export",
    "",
    `Gerado em ${new Date().toISOString()} · ${rows.length} eventos`,
    "",
    "Sanitizado: CNPJ/CPF/XML removidos. Sem claim SOC2/ISO.",
    "",
  ];
  for (const r of rows.slice(0, 500)) {
    lines.push(`- \`${r.at}\` [${r.source}] ${r.action} — ${r.detail}`);
  }
  return lines.join("\n");
}
