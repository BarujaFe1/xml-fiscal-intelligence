import { describe, expect, it } from "vitest";
import { XMLParser } from "fast-xml-parser";
import { readFileSync } from "fs";
import path from "path";
import {
  extractAuthorizationProtocol,
  extractCTeSummary,
  extractNFeSummary,
} from "@/lib/parser/extract";
import {
  computeCnpjCheckDigits,
  formatCnpj,
  isValidCnpj,
  isValidCnpjOrCpf,
  normalizeCnpj,
} from "@/lib/fiscal/cnpj";
import { detectRuleAnomalies, applyProtocolAnomalyPolicy } from "@/modules/audit/rule-anomaly";
import type { AuditFinding } from "@/types";

const samples = path.join(process.cwd(), "samples", "anonymized");
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

describe("authorization protocol extraction", () => {
  it("extracts nProt from standard nfeProc/protNFe/infProt", () => {
    const xml = readFileSync(path.join(samples, "nfe-example.xml"), "utf8");
    const summary = extractNFeSummary(parser.parse(xml));
    expect(summary.protocol).toBe("135260000000001");
    expect(summary.authorizationDate).toBeTruthy();
  });

  it("extracts nProt from cteProc", () => {
    const xml = readFileSync(path.join(samples, "cte-example.xml"), "utf8");
    const summary = extractCTeSummary(parser.parse(xml));
    expect(summary.protocol).toBe("135260000000099");
  });

  it("handles prefixed namespace-like keys and missing protocol", () => {
    const withNs = {
      "nfe:nfeProc": {
        "nfe:protNFe": {
          "nfe:infProt": {
            "nfe:nProt": "999888777",
            "nfe:cStat": "100",
            "nfe:dhRecbto": "2026-03-01T10:00:00-03:00",
          },
        },
      },
    };
    expect(extractAuthorizationProtocol(withNs).protocol).toBe("999888777");
    expect(extractAuthorizationProtocol({ NFe: { infNFe: { ide: { nNF: "1" } } } }).protocol).toBeUndefined();
  });

  it("does not treat incomplete infProt as full protocol", () => {
    const incomplete = { protNFe: { infProt: { cStat: "100" } } };
    const auth = extractAuthorizationProtocol(incomplete);
    expect(auth.protocol).toBeUndefined();
    expect(auth.cStat).toBe("100");
  });
});

describe("CNPJ alphanumeric", () => {
  it("validates classic numeric CNPJ with DV", () => {
    // Known valid: 11.222.333/0001-81
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000180")).toBe(false);
  });

  it("validates official alphanumeric example 12.ABC.345/01DE-35", () => {
    expect(normalizeCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
    expect(computeCnpjCheckDigits("12ABC34501DE")).toBe("35");
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12ABC34501DE00")).toBe(false);
  });

  it("rejects forbidden chars and empty edge cases", () => {
    expect(isValidCnpj("")).toBe(true);
    expect(isValidCnpj("12ABC34501DE3!")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
    expect(isValidCnpjOrCpf("39053344705")).toBe(true);
    expect(isValidCnpjOrCpf("ABC")).toBe(false);
  });

  it("formats without destroying letters", () => {
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});

describe("RTC observation", () => {
  it("flags CBS/IBS hints without inventing amounts", async () => {
    const { observeRtcTags } = await import("@/lib/parser/rtc-observe");
    const obs = observeRtcTags({
      flattenedKeys: ["imposto.ICMS.vICMS", "imposto.IBSCBS.vCBS", "det.imposto.gIBS"],
    });
    expect(obs.hasRtcHints).toBe(true);
    expect(obs.matchedKeys.some((k) => /CBS|IBS/i.test(k))).toBe(true);
    expect(obs.note).toMatch(/não interpretados/i);
  });
});

describe("zip security reasons", () => {
  it("marks executables as dangerous_extension", async () => {
    const { sanitizeZipEntryPath } = await import("@/lib/import/zip-security");
    const exe = sanitizeZipEntryPath("malware.exe");
    expect(exe.ok).toBe(false);
    if (exe.ok === false) expect(exe.reason).toBe("dangerous_extension");
    expect(sanitizeZipEntryPath("../../etc/passwd").ok).toBe(false);
  });
});

describe("rule anomaly", () => {
  it("flags mass NO_PROTOCOL and collapses findings", () => {
    const findings: AuditFinding[] = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`,
      workspaceId: "w",
      batchId: "b",
      documentId: `d${i}`,
      severity: "info",
      category: "protocolo",
      code: "NO_PROTOCOL",
      title: "Sem protocolo",
      description: "x",
      status: "open",
      createdAt: new Date().toISOString(),
    }));
    const anomalies = detectRuleAnomalies(findings, 10, 60);
    expect(anomalies[0]?.code).toBe("NO_PROTOCOL");
    const { findings: collapsed } = applyProtocolAnomalyPolicy(findings, 10);
    expect(collapsed.some((f) => f.code === "NO_PROTOCOL_ANOMALY")).toBe(true);
    expect(collapsed.filter((f) => f.code === "NO_PROTOCOL").length).toBeLessThanOrEqual(3);
  });
});
