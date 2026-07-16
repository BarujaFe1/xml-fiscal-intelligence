import { describe, expect, it } from "vitest";
import {
  getObligationSupport,
  listObligationSupport,
  isObligationSupported,
} from "@/modules/obligations/support-level";

describe("ObligationSupportLevel registry", () => {
  it("efd-icms-ipi é supported (validado em PR3)", () => {
    expect(getObligationSupport("efd-icms-ipi").level).toBe("supported");
    expect(isObligationSupported("efd-icms-ipi")).toBe(true);
  });

  it("UF específica usa fallback global quando não há override", () => {
    expect(getObligationSupport("efd-icms-ipi", "RS").level).toBe("supported");
  });

  it("obrigação não mapeada é planned", () => {
    expect(getObligationSupport("inexistente").level).toBe("planned");
  });

  it("listObligationSupport inclui as obrigações conhecidas", () => {
    const ids = listObligationSupport().map((e) => e.obligationId);
    expect(ids).toContain("efd-icms-ipi");
    expect(ids).toContain("efd-contribuicoes");
  });
});
