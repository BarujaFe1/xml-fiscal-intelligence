import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { detectDocumentType } from "@/lib/parser/detect";
import { flattenXmlObject } from "@/lib/parser/flatten";
import {
  extractCTeLinkedDocs,
  extractCTeSummary,
  extractNFSeServiceDetails,
  extractNFSeSummary,
  extractNFeItems,
  extractNFeSummary,
} from "@/lib/parser/extract";
import { parseXmlDocument } from "@/lib/parser";
import { calculateBatchQuality } from "@/lib/quality";
import { searchBatchStore } from "@/lib/search";
import { buildDocumentsCsv } from "@/lib/export/excel";
import type { Batch, BatchStore } from "@/types";

const samples = path.join(process.cwd(), "samples", "anonymized");
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

function load(name: string) {
  return readFileSync(path.join(samples, name), "utf8");
}

describe("detectDocumentType", () => {
  it("detects NFE", () => {
    const xml = load("nfe-example.xml");
    expect(detectDocumentType(parser.parse(xml), xml)).toBe("NFE");
  });
  it("detects CTE", () => {
    const xml = load("cte-example.xml");
    expect(detectDocumentType(parser.parse(xml), xml)).toBe("CTE");
  });
  it("detects NFSE", () => {
    const xml = load("nfse-example.xml");
    expect(detectDocumentType(parser.parse(xml), xml)).toBe("NFSE");
  });
  it("returns UNKNOWN for garbage", () => {
    expect(detectDocumentType({ foo: { bar: 1 } }, "<foo><bar>1</bar></foo>")).toBe("UNKNOWN");
  });
});

describe("flattenXmlObject", () => {
  it("flattens nested paths and arrays", () => {
    const fields = flattenXmlObject({
      NFe: { infNFe: { det: [{ prod: { xProd: "A" } }, { prod: { xProd: "B" } }] } },
    });
    const paths = fields.map((f) => f.pathNormalized);
    expect(paths.some((p) => p.includes("det.prod.xProd") || p.includes("xProd"))).toBe(true);
    expect(fields.find((f) => String(f.value) === "A")).toBeTruthy();
    expect(fields.find((f) => String(f.value) === "B")).toBeTruthy();
  });
});

describe("extractors", () => {
  it("extracts NFe summary and multiple items", () => {
    const xml = load("nfe-example.xml");
    const parsed = parser.parse(xml);
    const summary = extractNFeSummary(parsed);
    const items = extractNFeItems(parsed);
    expect(summary.number).toBe("1234");
    expect(summary.accessKey).toContain("352603");
    expect(summary.totalValue).toBe(5400);
    expect(summary.protocol).toBe("135260000000001");
    expect(items.length).toBe(2);
    expect(items[0].ncm).toBe("84713012");
    expect(items[1].cfop).toBe("5102");
  });

  it("extracts CTe summary and linked docs", () => {
    const xml = load("cte-example.xml");
    const parsed = parser.parse(xml);
    const summary = extractCTeSummary(parsed);
    const docs = extractCTeLinkedDocs(parsed);
    expect(summary.number).toBe("555");
    expect(summary.totalValue).toBe(850);
    expect(docs.length).toBeGreaterThan(0);
  });

  it("extracts NFSe summary and service detail", () => {
    const xml = load("nfse-example.xml");
    const parsed = parser.parse(xml);
    const summary = extractNFSeSummary(parsed);
    const details = extractNFSeServiceDetails(parsed);
    expect(summary.number).toBe("1001");
    expect(summary.totalValue).toBeTruthy();
    expect(details[0].description).toMatch(/software/i);
  });
});

describe("parseXmlDocument", () => {
  it("handles malformed XML without throwing", () => {
    const result = parseXmlDocument({
      xml: "<NFe><broken>",
      fileName: "broken.xml",
      batchId: "b1",
      workspaceId: "w1",
    });
    expect(result.document.parseStatus).toBe("error");
    expect(result.error).toBeTruthy();
  });

  it("parses anonymized NFe end-to-end", () => {
    const result = parseXmlDocument({
      xml: load("nfe-example.xml"),
      fileName: "nfe-example.xml",
      batchId: "b1",
      workspaceId: "w1",
    });
    expect(result.document.documentType).toBe("NFE");
    expect(result.items.length).toBe(2);
    expect(result.fields.length).toBeGreaterThan(10);
  });
});

describe("quality + search + export", () => {
  it("calculates health score and searchable fields", () => {
    const nfe = parseXmlDocument({
      xml: load("nfe-example.xml"),
      fileName: "nfe.xml",
      batchId: "b1",
      workspaceId: "w1",
    });
    const cte = parseXmlDocument({
      xml: load("cte-example.xml"),
      fileName: "cte.xml",
      batchId: "b1",
      workspaceId: "w1",
    });
    const batch: Batch = {
      id: "b1",
      workspaceId: "w1",
      name: "test",
      uploadedFileName: "t.zip",
      status: "completed",
      totalFiles: 2,
      totalXml: 2,
      validXml: 2,
      invalidXml: 0,
      nfeCount: 1,
      cteCount: 1,
      nfseCount: 0,
      unknownCount: 0,
      duplicateCount: 0,
      totalValue: 6250,
      healthScore: 0,
      progress: 100,
      progressMessage: "done",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      month: 3,
      year: 2026,
    };
    const store: BatchStore = {
      batch,
      documents: [nfe.document, cte.document],
      items: [...nfe.items, ...cte.items],
      fields: [...nfe.fields, ...cte.fields],
      errors: [],
      exports: [],
    };
    const quality = calculateBatchQuality(batch, store.documents, store.items, store.fields, []);
    expect(quality.score).toBeGreaterThan(50);
    expect(quality.score).toBeLessThanOrEqual(100);

    const results = searchBatchStore(store, "Notebook");
    expect(results.some((r) => r.kind === "item" || r.kind === "document" || r.kind === "field")).toBe(
      true,
    );

    const csv = buildDocumentsCsv(store);
    expect(csv).toContain("NFE");
    expect(csv.split("\n").length).toBeGreaterThan(2);
  });
});
