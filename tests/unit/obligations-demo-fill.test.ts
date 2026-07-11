import { describe, expect, it } from "vitest";
import { DEMO_BATCH_ID, DEMO_ESTABLISHMENT } from "@/modules/obligations/demo-fixtures";

describe("demo fixtures", () => {
  it("tem estabelecimento demo preenchido", () => {
    expect(DEMO_ESTABLISHMENT.cnpj).toMatch(/^\d{14}$/);
    expect(DEMO_ESTABLISHMENT.companyName.length).toBeGreaterThan(3);
    expect(DEMO_ESTABLISHMENT.periodStart).toBe("2026-03-01");
    expect(DEMO_BATCH_ID).toBe("__demo_sample__");
  });
});
