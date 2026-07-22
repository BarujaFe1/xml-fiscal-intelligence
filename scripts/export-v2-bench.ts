/**
 * Measured export benchmarks (synthetic fixtures, local machine).
 * Re-run: npx tsx --tsconfig tsconfig.json scripts/export-v2-bench.ts
 *
 * Do not invent numbers — only record measured outputs.
 */
import { performance } from "node:perf_hooks";
import {
  buildExportDataset,
} from "../src/lib/export/v2/dataset";
import { buildWorkbookFromDataset } from "../src/lib/export/v2/excel";
import { buildDocumentsCsvFromDataset } from "../src/lib/export/v2/csv";
import { buildJsonFromDataset } from "../src/lib/export/v2/json";
import { buildCompletePackage } from "../src/lib/export/v2/package";
import type { BatchStore, DocumentSummary } from "../src/types";

function makeDocs(n: number): DocumentSummary[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `d${i}`,
    workspaceId: "w",
    batchId: "b",
    documentType: "NFE" as const,
    fileName: `d${i}.xml`,
    accessKey: `3526061234567890123455001000000001${String(i).padStart(10, "0")}`.slice(0, 44),
    number: String(i + 1),
    issueDate: "2026-06-15T12:00:00.000Z",
    totalValue: 10.1 + (i % 7) * 0.01,
    emitterName: `Emitente ${i}`,
    rawJson: {},
    flattenedJson: {},
    parseStatus: "ok" as const,
    parseErrors: [],
    createdAt: new Date().toISOString(),
  }));
}

function store(n: number): BatchStore {
  const documents = makeDocs(n);
  return {
    batch: {
      id: "b",
      workspaceId: "w",
      name: `bench-${n}`,
      uploadedFileName: "b.zip",
      status: "completed",
      totalFiles: n,
      totalXml: n,
      validXml: n,
      invalidXml: 0,
      nfeCount: n,
      cteCount: 0,
      nfseCount: 0,
      unknownCount: 0,
      duplicateCount: 0,
      totalValue: 0,
      healthScore: 90,
      progress: 100,
      progressMessage: "ok",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      month: 7,
      year: 2026,
    },
    documents,
    items: [],
    fields: [],
    errors: [],
    exports: [],
    findings: [],
    relationships: [],
    importLogs: [],
  };
}

async function bench(label: string, fn: () => Promise<number> | number) {
  const t0 = performance.now();
  const size = await fn();
  const ms = performance.now() - t0;
  console.log(`${label}: ${ms.toFixed(1)} ms · ${size} bytes`);
}

async function main() {
  for (const n of [10, 100, 500]) {
    console.log(`\n=== ${n} documents ===`);
    const s = store(n);
    const ids = s.documents.map((d) => d.id);
    const t0 = performance.now();
    const ds = buildExportDataset(s, ids, { privacyProfile: "operational_full" });
    console.log(`dataset: ${(performance.now() - t0).toFixed(1)} ms`);

    await bench("csv-docs", () => {
      const csv = buildDocumentsCsvFromDataset(ds);
      return csv.length;
    });
    await bench("json-compact", () => {
      const j = buildJsonFromDataset(ds, "compact");
      return j.length;
    });
    await bench("xlsx", async () => {
      const buf = await buildWorkbookFromDataset(ds);
      return buf.byteLength;
    });
    await bench("package(no-xml)", async () => {
      const pkg = await buildCompletePackage({
        dataset: ds,
        artifacts: ["xlsx", "csv", "json", "html", "keys"],
      });
      return pkg.blob.size;
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
