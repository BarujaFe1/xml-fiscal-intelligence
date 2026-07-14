/**
 * Minimal ECD prior TXT → accounts/hints (I050 lines only).
 * Does not invent amounts.
 */

import type { ChartAccount } from "@/modules/accounting/types";

export function parseEcdPriorI050(
  txt: string,
  meta: { workspaceId: string; companyId: string },
): ChartAccount[] {
  const now = new Date().toISOString();
  const out: ChartAccount[] = [];
  for (const line of txt.split(/\r?\n/)) {
    if (!line.includes("|I050|")) continue;
    const fields = line.split("|").filter((x, idx, a) => idx > 0 && idx < a.length - 1);
    if (fields[0] !== "I050") continue;
    // Guia-ish: REG DT_ALT COD_NAT IND_CTA NÍVEL COD_CTA NOME ...
    const nature = (fields[2] || "01") as ChartAccount["nature"];
    const ind = fields[3] || "A";
    const level = Number(fields[4]) || 1;
    const code = fields[5] || "";
    const name = fields[6] || code;
    if (!code) continue;
    out.push({
      id: `acc_ecd_${meta.companyId}_${code}`,
      workspaceId: meta.workspaceId,
      companyId: meta.companyId,
      code,
      name,
      level,
      nature: ["01", "02", "03", "04", "05", "09"].includes(nature) ? nature : "01",
      kind: ind === "S" ? "synthetic" : "analytic",
      effectiveFrom: now.slice(0, 10),
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  return out;
}
