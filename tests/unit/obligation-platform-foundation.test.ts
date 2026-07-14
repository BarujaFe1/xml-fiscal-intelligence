import { describe, expect, it } from "vitest";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations/core/registry/maturity-profiles";
import { OFFICIAL_SOURCE_CATALOG, getOfficialSource } from "@/modules/obligations/core/sources/catalog";
import { readinessPercent } from "@/modules/obligations/core/readiness/aggregate";
import { emptyCell, cardReadiness } from "@/modules/obligations/core/workflows/closing";
import { listCalendarRules } from "@/modules/obligations/core/workflows/calendar";
import { MASTER_ENTITY_CATALOG } from "@/modules/master-data";

describe("obligation platform foundation", () => {
  it("never marks production maturity without evidence", () => {
    for (const p of Object.values(OBLIGATION_SUPPORT_PROFILES)) {
      expect(p.maturity).not.toBe("production");
      expect(p.maturity).not.toBe("validated_scope");
      expect(p.limitations.length).toBeGreaterThan(0);
      expect(p.sourceIds.length).toBeGreaterThan(0);
    }
  });

  it("catalog has SPED portal and duty-specific sources", () => {
    expect(getOfficialSource("official:sped:portal")?.url).toContain("gov.br/sped");
    expect(OFFICIAL_SOURCE_CATALOG.length).toBeGreaterThan(20);
    expect(
      OFFICIAL_SOURCE_CATALOG.some((s) => s.obligation === "efd-icms-ipi"),
    ).toBe(true);
  });

  it("readiness percent treats blocking as zero", () => {
    const pct = readinessPercent({
      canGenerate: false,
      blockingCount: 1,
      items: [
        { id: "a", label: "a", status: "complete" },
        { id: "b", label: "b", status: "blocking" },
      ],
    });
    expect(pct).toBe(50);
  });

  it("closing cell defaults to not_started", () => {
    const cell = emptyCell("efd-icms-ipi");
    expect(cell.status).toBe("not_started");
    expect(cell.checklist.length).toBeGreaterThan(0);
    expect(
      cardReadiness({
        id: "x",
        workspaceId: "w",
        companyId: "c",
        companyLabel: "C",
        establishmentId: "e",
        establishmentLabel: "E",
        periodKey: "2026-07",
        periodKind: "monthly",
        cells: { "efd-icms-ipi": cell },
        createdAt: "",
        updatedAt: "",
      }),
    ).toBe(0);
  });

  it("fiscal calendar has no invented due dates", () => {
    const rules = listCalendarRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.sourceId.startsWith("official:"))).toBe(true);
    expect(rules.every((r) => !/\bdia\s*\d{1,2}\b/i.test(`${r.dueRule || ""} ${r.description}`))).toBe(
      true,
    );
  });

  it("master data catalog separates live vs planned", () => {
    expect(MASTER_ENTITY_CATALOG.some((e) => e.status === "live")).toBe(true);
    expect(MASTER_ENTITY_CATALOG.some((e) => e.status === "planned")).toBe(true);
  });
});
