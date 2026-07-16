import { describe, it, expect } from "vitest";
import { parsePvaReportText, inferPvaStatus } from "@/modules/obligations/efd-icms-ipi/pva/workflow";

describe("parsePvaReportText", () => {
  it("parses a block-style PVA error with structured fields", () => {
    const report = `ERRO
Registro: 0000
Campo: 02
Linha: 1
Regra: E001
Valor: 202606
Mensagem: O período informado é incompatível com a data de escrituração.`;

    const issues = parsePvaReportText(report);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].recordType).toBe("0000");
    expect(issues[0].field).toBe("02");
    expect(issues[0].line).toBe("1");
    expect(issues[0].rule).toBe("E001");
    expect(issues[0].value).toBe("202606");
    expect(issues[0].message).toMatch(/período informado/i);
  });

  it("parses an inline single-line error", () => {
    const report = "Erro no Registro 0000, Campo 02, Linha 1: período incompatível";
    const issues = parsePvaReportText(report);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].recordType).toBe("0000");
    expect(issues[0].field).toBe("02");
    expect(issues[0].line).toBe("1");
  });

  it("parses the 'E001 - Bloco 0 - Registro 0000' shape and the block letter", () => {
    const report = "E001 - Bloco 0 - Registro 0000: período incompatível com a vigência";
    const issues = parsePvaReportText(report);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].rule).toBe("E001");
    expect(issues[0].block).toBe("0");
    expect(issues[0].recordType).toBe("0000");
  });

  it("keeps warnings and unrecognized lines without dropping them", () => {
    const report = `AVISO
Registro: C100
Campo: 10
Mensagem: Totalizador diverge do livro fiscal.

Linha aleatória sem padrão conhecido`;
    const issues = parsePvaReportText(report);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].recordType).toBe("C100");
    expect(issues.some((i) => /sem padrão conhecido/.test(i.message))).toBe(true);
  });

  it("returns empty for blank input", () => {
    expect(parsePvaReportText("")).toEqual([]);
    expect(parsePvaReportText("   \n  ")).toEqual([]);
  });

  it("inferPvaStatus reflects errors/warnings", () => {
    expect(inferPvaStatus([])).toBe("ok");
    expect(inferPvaStatus([{ severity: "error", message: "x" }])).toBe("errors");
    expect(inferPvaStatus([{ severity: "warning", message: "x" }])).toBe("warnings");
  });
});
