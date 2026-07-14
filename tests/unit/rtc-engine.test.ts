import { describe, expect, it } from "vitest";
import { resolveRtcPeriodSplit, assertContribModulePreserved } from "@/modules/rtc/period";
import { RTC_RULE_SET_VERSIONS, cataloguedRtcImpacts } from "@/modules/rtc/rule-sets";
import { reconcileRtcVsContribCredits } from "@/modules/rtc/dual-contrib";
import { extractRtcFactsFromXml } from "@/modules/rtc/extract";
import { simulateRtcImpact } from "@/modules/rtc/simulator";
import { detectRtcReadiness } from "@/modules/rtc/readiness";
import { RTC_MODULE_MATURITY } from "@/modules/rtc/maturity";
import { isHomologationGradeRtcRun } from "@/modules/rtc/homologation";
import { listSupportedModes } from "@/modules/contrib/modes";
import type { RtcFact } from "@/modules/rtc/types";
import type { ContribEntry } from "@/modules/contrib/types";

function fact(partial: Partial<RtcFact> & Pick<RtcFact, "id" | "taxKind">): RtcFact {
  const now = new Date().toISOString();
  return {
    workspaceId: "ws",
    companyId: "co",
    periodKey: "2026-03",
    split: "transition",
    creditExplicit: false,
    origin: "manual",
    sourceId: "official:reforma:consumo-2026",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("RTC engine Fase 8", () => {
  it("resolve split sem inventar alíquota", () => {
    expect(resolveRtcPeriodSplit("2025-12").split).toBe("pre_reform");
    expect(resolveRtcPeriodSplit("2026-06").split).toBe("transition");
    expect(resolveRtcPeriodSplit("2027-01").split).toBe("post_reform");
    expect(resolveRtcPeriodSplit("2026-01").sourceId).toBe("official:reforma:consumo-2026");
  });

  it("preserva modos dual Contrib", () => {
    expect(assertContribModulePreserved().ok).toBe(true);
    expect(listSupportedModes()).toContain("historical_and_credit_management");
  });

  it("rule_sets RTC catalogadas inativas", () => {
    expect(RTC_RULE_SET_VERSIONS.every((r) => r.activated === false)).toBe(true);
    expect(cataloguedRtcImpacts("2026-03-01").some((x) => /REFORMA_CONSUMO/.test(x))).toBe(true);
  });

  it("extração XML não inventa pIBS vazio", () => {
    const out = extractRtcFactsFromXml({
      workspaceId: "ws",
      companyId: "co",
      periodKey: "2026-03",
      flattened: { vCBS: "50.00", pIBS: "" },
      rawXml: "<vCBS>50.00</vCBS><pIBS></pIBS>",
    });
    const cbs = out.facts.find((f) => f.taxKind === "CBS");
    const ibs = out.facts.find((f) => f.taxKind === "IBS_UF");
    expect(cbs?.taxAmountExplicit).toBe("50.00");
    expect(ibs?.rateExplicit).toBeUndefined();
    expect(out.warnings.some((w) => /pIBS/i.test(w) || /sem valor/i.test(w))).toBe(true);
  });

  it("reconciliação dual + readiness", () => {
    const credits: ContribEntry[] = [
      {
        id: "c1",
        workspaceId: "ws",
        companyId: "co",
        periodKey: "2025-12",
        kind: "credit",
        amount: "10,00",
        creditExplicit: true,
        origin: "manual",
        mode: "historical_and_credit_management",
        createdAt: "",
        updatedAt: "",
      },
    ];
    const r = reconcileRtcVsContribCredits({
      periodKey: "2026-03",
      rtcFacts: [],
      contribEntries: credits,
    });
    expect(r.contribPreserved).toBe(true);
    expect(r.findings.some((f) => f.code === "LEGACY_CREDIT_UNLINKED")).toBe(true);

    const ready = detectRtcReadiness({
      periodKey: "2026-03",
      snapshot: {
        facts: [fact({ id: "1", taxKind: "CBS", taxAmountExplicit: "10,00" })],
        periodKey: "2026-03",
        split: "transition",
      },
      contribEntries: credits,
    });
    expect(ready.canMaterializeLab).toBe(true);
  });

  it("simulador gated e forceEnable só com valores explícitos", () => {
    const off = simulateRtcImpact({
      facts: [],
      periodKey: "2026-03",
      split: "transition",
    });
    expect(off.enabled).toBe(false);

    const on = simulateRtcImpact(
      {
        facts: [
          fact({ id: "1", taxKind: "CBS", taxAmountExplicit: "100,00" }),
          fact({
            id: "2",
            taxKind: "IBS_UF",
            taxAmountExplicit: "50,00",
          }),
        ],
        periodKey: "2026-03",
        split: "transition",
      },
      { forceEnable: true, legacyCreditAmount: "30,00" },
    );
    expect(on.scenarios.find((s) => s.id === "legacy_credit_on")?.netEstimate).toBe("120,00");
    expect(on.scenarios.find((s) => s.id === "legacy_credit_off")?.netEstimate).toBe("150,00");
  });

  it("maturidade development e homologation exige status conhecido", () => {
    expect(RTC_MODULE_MATURITY).toBe("development");
    expect(
      isHomologationGradeRtcRun({
        contentHash: "ab".repeat(16),
        programVersion: "1",
        resultStatus: "unknown",
      }),
    ).toBe(false);
  });
});
