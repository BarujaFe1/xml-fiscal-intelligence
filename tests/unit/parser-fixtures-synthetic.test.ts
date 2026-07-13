import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { detectDocumentType } from "@/lib/parser/detect";
import { parseXmlDocument } from "@/lib/parser";
import { XMLParser } from "fast-xml-parser";

const fixtures = path.join(process.cwd(), "tests", "fixtures", "synthetic");
const samples = path.join(process.cwd(), "samples", "anonymized");

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: false,
});

function loadFixture(name: string) {
  return readFileSync(path.join(fixtures, name), "utf8");
}

describe("synthetic fixtures — document families", () => {
  it("detects NF-e with prefixed namespaces", () => {
    const xml = loadFixture("nfe-prefixed-ns.xml");
    expect(detectDocumentType(xmlParser.parse(xml), xml)).toBe("NFE");
    const parsed = parseXmlDocument({
      xml,
      fileName: "nfe-prefixed-ns.xml",
      batchId: "fx",
      workspaceId: "ws",
    });
    expect(parsed.document.parseStatus).not.toBe("error");
    expect(parsed.document.documentType).toBe("NFE");
    expect(parsed.document.emitterDoc).toContain("11222333000181");
    expect(parsed.document.emitterAddress).toMatch(/Fixture/i);
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].cfop).toBe("5102");
  });

  it("detects NFC-e modelo 65", () => {
    const xml = loadFixture("nfce-mod65.xml");
    expect(detectDocumentType(xmlParser.parse(xml), xml)).toBe("NFCE");
    const parsed = parseXmlDocument({
      xml,
      fileName: "nfce-mod65.xml",
      batchId: "fx",
      workspaceId: "ws",
    });
    expect(parsed.document.documentType).toBe("NFCE");
    expect(parsed.document.model).toBe("65");
    expect(parsed.document.totalValue).toBe(10);
  });

  it("detects cancellation event", () => {
    const xml = loadFixture("evento-cancelamento-nfe.xml");
    expect(detectDocumentType(xmlParser.parse(xml), xml)).toBe("CANCELATION");
    const parsed = parseXmlDocument({
      xml,
      fileName: "evento-cancelamento-nfe.xml",
      batchId: "fx",
      workspaceId: "ws",
    });
    expect(parsed.document.documentType).toBe("CANCELATION");
  });

  it("still detects default-namespace samples (NFE/CTE/NFSE)", () => {
    for (const [file, type] of [
      ["nfe-example.xml", "NFE"],
      ["cte-example.xml", "CTE"],
      ["nfse-example.xml", "NFSE"],
    ] as const) {
      const xml = readFileSync(path.join(samples, file), "utf8");
      expect(detectDocumentType(xmlParser.parse(xml), xml)).toBe(type);
    }
  });
});

describe("parser security baseline (fixtures)", () => {
  it("does not expand external entities (XXE guard)", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe><ide><nNF>&xxe;</nNF><mod>55</mod></ide></infNFe></NFe></nfeProc>`;
    const parsed = parseXmlDocument({
      xml,
      fileName: "xxe.xml",
      batchId: "fx",
      workspaceId: "ws",
    });
    // With processEntities:false the entity should not resolve to file contents
    const number = parsed.document.number || "";
    expect(number).not.toMatch(/root:/);
  });
});
