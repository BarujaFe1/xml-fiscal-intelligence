/**
 * Inventory acceptance metrics for a real NF-e ZIP fixture.
 * Does NOT write fiscal content into the repo — prints counts only.
 *
 * Usage:
 *   npx tsx scripts/fixture-inventory-metrics.ts "C:\path\to\202606 NFe.zip"
 */
import fs from "fs";
import path from "path";
import { processZipBatchInMemory } from "../src/lib/store/process-memory";

async function main() {
  const zipPath = process.argv[2];
  if (!zipPath || !fs.existsSync(zipPath)) {
    console.error("Usage: npx tsx scripts/fixture-inventory-metrics.ts <zipPath>");
    process.exit(2);
  }
  const buffer = fs.readFileSync(zipPath);
  const { store } = await processZipBatchInMemory({
    buffer,
    fileName: path.basename(zipPath),
    keepRawJson: false,
    keepFields: false,
    captureRawXml: false,
  });

  const docs = store.documents;
  const model55 = docs.filter((d) => d.model === "55" || d.documentType === "NFE").length;
  let cClassTribDocs = 0;
  let cbsTotDocs = 0;
  let ibsTotDocs = 0;
  let dupDocs = 0;
  const pathSet = new Set<string>();

  for (const d of docs) {
    const flat = d.flattenedJson || {};
    let hasCClass = false;
    let hasCbs = false;
    let hasIbs = false;
    let hasDup = false;
    for (const [k, v] of Object.entries(flat)) {
      pathSet.add(k);
      if (/cClassTrib$/i.test(k) && v != null && String(v) !== "") hasCClass = true;
      if (/IBSCBSTot\.gCBS\.vCBS$/i.test(k) || /total\.[^.]+\.gCBS\.vCBS$/i.test(k)) hasCbs = true;
      if (/IBSCBSTot\.gIBS\.vIBS$/i.test(k) || /total\.[^.]+\.gIBS\.vIBS$/i.test(k)) hasIbs = true;
      if (/cobr\.dup\.vDup$/i.test(k) || /dup\.vDup$/i.test(k)) hasDup = true;
    }
    if (hasCClass) cClassTribDocs += 1;
    if (hasCbs) cbsTotDocs += 1;
    if (hasIbs) ibsTotDocs += 1;
    if (hasDup) dupDocs += 1;
  }

  const out = {
    zip: path.basename(zipPath),
    documents: docs.length,
    model55,
    selectablePaths: pathSet.size,
    cClassTribDocs,
    cbsTotDocs,
    ibsTotDocs,
    dupDocs,
    expected: {
      documents: 1155,
      model55: 1155,
      selectablePaths: 518,
      cClassTribDocs: 782,
      cbsTotDocs: 670,
      ibsTotDocs: 670,
      dupDocs: 458,
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
