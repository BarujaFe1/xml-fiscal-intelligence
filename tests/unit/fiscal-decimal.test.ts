import { describe, expect, it } from "vitest";
import {
  addFiscal,
  compareFiscal,
  formatFiscalForEfd,
  mulFiscal,
  parseFiscalDecimal,
  subFiscal,
} from "@/lib/fiscal/decimal";

describe("FiscalDecimal", () => {
  it("soma sem erro de float", () => {
    expect(addFiscal("0.1", "0.2")).toBe("0.30");
  });

  it("subtrai e multiplica com arredondamento half-up", () => {
    expect(subFiscal("10.00", "0.01")).toBe("9.99");
    expect(mulFiscal("2.50", "2")).toBe("5.00");
  });

  it("serializa para EFD com vírgula", () => {
    expect(formatFiscalForEfd(parseFiscalDecimal("1250.9"))).toBe("1250,90");
  });

  it("compara", () => {
    expect(compareFiscal("1.00", "1.00")).toBe(0);
    expect(compareFiscal("1.01", "1.00")).toBe(1);
  });
});
