import { describe, expect, it } from "vitest";
import { money, moneyAdd, moneyToEfd, moneyToFixed } from "@/lib/money/decimal";
import { sanitizeSpreadsheetCell, sanitizeSpreadsheetRow } from "@/lib/export/sanitize";
import { createRequestId, sanitizeLogMessage } from "@/lib/observability";
import { getAuditRuleByCode, resolveAuditRuleVersion } from "@/modules/audit/rule-catalog";

describe("money decimal", () => {
  it("adds without float drift", () => {
    const sum = moneyAdd("0.1", "0.2");
    expect(moneyToFixed(sum, 2)).toBe("0.30");
  });

  it("rounds half-up explicitly for display", () => {
    expect(money("1.005").toFixed(2)).toBe("1.01");
    expect(moneyToEfd("10.5", 2)).toBe("10,50");
  });

  it("chains plus", () => {
    expect(money("100.10").plus("0.05").toFixed(2)).toBe("100.15");
  });
});

describe("spreadsheet sanitize", () => {
  it("neutralizes formula-like cells", () => {
    expect(sanitizeSpreadsheetCell("=CMD()")).toBe("'=CMD()");
    expect(sanitizeSpreadsheetCell("+1+1")).toBe("'+1+1");
    expect(sanitizeSpreadsheetCell("@SUM")).toBe("'@SUM");
    expect(sanitizeSpreadsheetCell("Normal")).toBe("Normal");
  });

  it("sanitizes row strings only", () => {
    const row = sanitizeSpreadsheetRow({ a: "=1", b: 12, c: null });
    expect(row.a).toBe("'=1");
    expect(row.b).toBe(12);
  });
});

describe("observability sanitize", () => {
  it("redacts access keys and bearer tokens", () => {
    const msg = sanitizeLogMessage(
      `chave 35260312345678901234567890123456789012345678 Bearer abc.def`,
    );
    expect(msg).toContain("[CHAVE]");
    expect(msg).toContain("[REDACTED]");
    expect(createRequestId()).toMatch(/^req_/);
  });
});

describe("audit rule catalog", () => {
  it("resolves versioned NO_PROTOCOL rule", () => {
    const rule = getAuditRuleByCode("NO_PROTOCOL");
    expect(rule?.nature).toBe("objective");
    expect(resolveAuditRuleVersion("NO_PROTOCOL", "2026-03-01")?.version).toBeTruthy();
  });
});
