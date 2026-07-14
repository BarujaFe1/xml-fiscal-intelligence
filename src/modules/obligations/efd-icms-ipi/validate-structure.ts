/**
 * Level-1 structural checks for EFD ICMS/IPI record order (commons).
 */

const BLOCK_OPENERS = ["0000", "B001", "C001", "D001", "E001", "G001", "H001", "K001", "1001", "9001"] as const;

export type StructuralIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
};

/** Assert main block openers appear in Guia order when present. */
export function validateBlockOpenerOrder(recordTypes: string[]): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  const positions: Array<{ type: string; index: number }> = [];
  for (let i = 0; i < recordTypes.length; i++) {
    const t = recordTypes[i]!;
    if ((BLOCK_OPENERS as readonly string[]).includes(t)) {
      positions.push({ type: t, index: i });
    }
  }
  const order = BLOCK_OPENERS as readonly string[];
  let lastRank = -1;
  for (const p of positions) {
    const rank = order.indexOf(p.type as (typeof BLOCK_OPENERS)[number]);
    if (rank < lastRank) {
      issues.push({
        code: "EFD_BLOCK_ORDER",
        severity: "error",
        message: `Bloco fora de ordem: ${p.type} após opener de rank maior`,
      });
    }
    lastRank = Math.max(lastRank, rank);
  }
  if (!recordTypes.includes("0000")) {
    issues.push({ code: "EFD_MISSING_0000", severity: "error", message: "0000 ausente" });
  }
  if (!recordTypes.includes("9999")) {
    issues.push({ code: "EFD_MISSING_9999", severity: "error", message: "9999 ausente" });
  }
  return issues;
}

/** Expected 0400 field count including REG (Guia). */
export const EFD_0400_FIELD_COUNT = 3; // REG, COD_NAT, DESCR_NAT — confirm against guide when generating
