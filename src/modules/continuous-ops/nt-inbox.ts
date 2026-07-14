/**
 * Inbox de NTs — identified → impact → draft_rule_set; sem auto-ativar.
 */

import type { NtInboxItem, NtInboxStatus } from "@/modules/continuous-ops/types";
import type { ObligationId } from "@/modules/obligations/core/registry/ids";

const ORDER: NtInboxStatus[] = [
  "identified",
  "impact_assessment",
  "draft_rule_set",
  "awaiting_fixture",
  "ready_for_review",
  "rejected",
];

export function createNtInboxItem(input: {
  workspaceId: string;
  sourceId: string;
  title: string;
  obligationId?: NtInboxItem["obligationId"];
  impactManifest?: string[];
}): NtInboxItem {
  const now = new Date().toISOString();
  return {
    id: `nt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: input.workspaceId,
    sourceId: input.sourceId,
    title: input.title,
    obligationId: input.obligationId || "platform",
    status: "identified",
    impactManifest: input.impactManifest || [],
    ruleSetActivated: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function advanceNtStatus(
  item: NtInboxItem,
  to: NtInboxStatus,
  patch?: Partial<NtInboxItem>,
): NtInboxItem {
  if (to === "rejected") {
    return {
      ...item,
      ...patch,
      status: "rejected",
      ruleSetActivated: false,
      updatedAt: new Date().toISOString(),
    };
  }
  const fromIdx = ORDER.indexOf(item.status);
  const toIdx = ORDER.indexOf(to);
  if (toIdx !== fromIdx + 1) {
    throw new Error(`transição NT inválida ${item.status} → ${to}`);
  }
  if (to === "ready_for_review" && !item.fixtureId && !patch?.fixtureId) {
    throw new Error("ready_for_review exige fixtureId");
  }
  return {
    ...item,
    ...patch,
    status: to,
    ruleSetActivated: false,
    updatedAt: new Date().toISOString(),
  };
}

export function diffImpactManifest(
  before: string[],
  after: string[],
): { added: string[]; removed: string[]; summary: string } {
  const b = new Set(before);
  const a = new Set(after);
  const added = [...a].filter((x) => !b.has(x));
  const removed = [...b].filter((x) => !a.has(x));
  return {
    added,
    removed,
    summary: `impacto +${added.length}/-${removed.length}`,
  };
}

export function assertNeverAutoActivated(items: NtInboxItem[]): boolean {
  return items.every((i) => i.ruleSetActivated === false);
}

export function seedNtFromOfficialSource(input: {
  workspaceId: string;
  sourceId: string;
  title: string;
  obligationId?: ObligationId | "rtc" | "platform";
}): NtInboxItem {
  return createNtInboxItem({
    ...input,
    impactManifest: [
      `Avaliar impacto de ${input.sourceId} — não ativar rule_set sem fixture`,
    ],
  });
}
