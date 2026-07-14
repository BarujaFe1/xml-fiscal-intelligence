/**
 * Políticas de retenção versionadas.
 */

import type { RetentionClass, RetentionPolicy } from "@/modules/governance/types";

export const DEFAULT_RETAIN_DAYS: Record<RetentionClass, number> = {
  evidence: 1825, // ~5 anos operacional típico — não é parecer jurídico
  xml_batch: 1825,
  generation_meta: 2555,
  audit_trail: 2555,
  api_keys: 365,
};

export function createRetentionPolicy(input: {
  workspaceId: string;
  class: RetentionClass;
  retainDays?: number;
  notes?: string;
  updatedBy?: string;
  previous?: RetentionPolicy | null;
}): RetentionPolicy {
  const version = (input.previous?.version ?? 0) + 1;
  return {
    id: `ret_${input.workspaceId}_${input.class}_v${version}`,
    workspaceId: input.workspaceId,
    version,
    class: input.class,
    retainDays: input.retainDays ?? DEFAULT_RETAIN_DAYS[input.class],
    notes: input.notes,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
}

export function seedDefaultRetention(workspaceId: string, updatedBy?: string): RetentionPolicy[] {
  return (Object.keys(DEFAULT_RETAIN_DAYS) as RetentionClass[]).map((c) =>
    createRetentionPolicy({ workspaceId, class: c, updatedBy }),
  );
}

export function isPastRetention(
  policy: RetentionPolicy,
  createdAtIso: string,
  now = new Date(),
): boolean {
  if (policy.retainDays <= 0) return false;
  const created = Date.parse(createdAtIso);
  if (Number.isNaN(created)) return false;
  const ageDays = (now.getTime() - created) / (24 * 3600 * 1000);
  return ageDays > policy.retainDays;
}

export function retentionSummaryMarkdown(policies: RetentionPolicy[]): string {
  const lines = [
    "# Políticas de retenção",
    "",
    "Template operacional — **não** constitui parecer jurídico nem DPA assinado.",
    "",
  ];
  for (const p of [...policies].sort((a, b) => a.class.localeCompare(b.class))) {
    lines.push(
      `- **${p.class}** v${p.version}: ${p.retainDays} dias${p.notes ? ` — ${p.notes}` : ""}`,
    );
  }
  return lines.join("\n");
}
