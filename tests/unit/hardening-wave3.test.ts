import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { flattenXmlObject, flatFieldsToRecord, indexedNormalizedPath } from "@/lib/parser/flatten";
import { observeRtcTags } from "@/lib/parser/rtc-observe";
import { formatCnpj, isValidCnpj, normalizeCnpj } from "@/lib/fiscal/cnpj";
import { comparePvaRuns, mapPvaIssuesToInternal } from "@/modules/obligations/efd-icms-ipi/pva/workflow";
import { XMLParser } from "fast-xml-parser";

describe("flatten preserves array indices (HYP-002)", () => {
  it("keeps det[0] and det[1] distinct in record keys", () => {
    const flat = flattenXmlObject({
      det: [
        { prod: { xProd: "A" } },
        { prod: { xProd: "B" } },
      ],
    });
    const record = flatFieldsToRecord(flat);
    expect(record["det[0].prod.xProd"]).toBe("A");
    expect(record["det[1].prod.xProd"]).toBe("B");
    expect(indexedNormalizedPath("nfe:det[0].prod.xProd")).toBe("det[0].prod.xProd");
  });

  it("does not stringify nested objects to [object Object]", () => {
    const flat = flattenXmlObject({ weird: { nested: true } });
    const record = flatFieldsToRecord(flat);
    expect(Object.values(record).every((v) => v !== "[object Object]")).toBe(true);
  });
});

describe("RTC observe fixture (REG-002)", () => {
  it("detects IBSCBS/gIBS hints without inventing amounts", () => {
    const xml = readFileSync(
      path.join(process.cwd(), "tests/fixtures/rtc-observe-nfe.xml"),
      "utf8",
    );
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: false,
    });
    const raw = parser.parse(xml);
    const fields = flattenXmlObject(raw);
    const keys = fields.map((f) => f.pathOriginal);
    const obs = observeRtcTags({ flattenedKeys: keys, rawXml: xml });
    expect(obs.hasRtcHints).toBe(true);
    expect(obs.matchedKeys.some((k) => /IBS|CBS/i.test(k))).toBe(true);
    expect(obs.note).toMatch(/não interpretados/i);
  });
});

describe("CNPJ alphanumeric export formatting (PARSER-002)", () => {
  it("formats alphanumeric CNPJ without stripping letters", () => {
    expect(normalizeCnpj("12.ABC.345/01DE-35")).toBe("12ABC34501DE35");
    expect(normalizeCnpj("12ABC34501DE35")).toContain("ABC");
    expect(isValidCnpj("12ABC34501DE35")).toBe(true);
    const formatted = formatCnpj("11222333000181");
    expect(formatted).toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    expect(formatCnpj("12ABC34501DE35")).toContain("ABC");
  });
});

describe("comparePvaRuns (FEATURE-002)", () => {
  it("diffs added and removed issues", () => {
    const left = mapPvaIssuesToInternal({
      generationId: "g1",
      pvaVersion: "5.0",
      resultStatus: "errors",
      issues: [
        { code: "E1", message: "erro um", severity: "error" },
        { code: "W1", message: "aviso", severity: "warning" },
      ],
    });
    const right = mapPvaIssuesToInternal({
      generationId: "g1",
      pvaVersion: "5.0",
      resultStatus: "errors",
      issues: [
        { code: "W1", message: "aviso", severity: "warning" },
        { code: "E2", message: "erro dois", severity: "error" },
      ],
    });
    const diff = comparePvaRuns(left, right);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.unchangedCount).toBe(1);
  });
});
