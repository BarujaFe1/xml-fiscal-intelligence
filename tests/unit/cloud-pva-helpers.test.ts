import { describe, expect, it } from "vitest";
import { isUuid, uuidFromLocalKey } from "@/lib/cloud/stable-uuid";
import { pvaResultToGenerationStatus } from "@/modules/obligations/efd-icms-ipi/pva/workflow";

describe("stable-uuid", () => {
  it("preserva UUID válido", () => {
    const u = "550e8400-e29b-41d4-a716-446655440000";
    expect(isUuid(u)).toBe(true);
    expect(uuidFromLocalKey("workspace", u)).toBe(u.toLowerCase());
  });

  it("gera UUID determinístico para chave local", () => {
    const a = uuidFromLocalKey("workspace", "ws_local_demo");
    const b = uuidFromLocalKey("workspace", "ws_local_demo");
    expect(a).toBe(b);
    expect(isUuid(a)).toBe(true);
    expect(a).not.toBe(uuidFromLocalKey("workspace", "other"));
  });
});

describe("pvaResultToGenerationStatus", () => {
  it("mapeia resultados PVA para lifecycle EFD", () => {
    expect(pvaResultToGenerationStatus("ok")).toBe("pva_validated");
    expect(pvaResultToGenerationStatus("errors")).toBe("pva_rejected");
    expect(pvaResultToGenerationStatus("warnings")).toBe("pva_validated");
  });
});
