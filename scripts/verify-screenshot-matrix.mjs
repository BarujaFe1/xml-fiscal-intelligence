// scripts/verify-screenshot-matrix.mjs
//
// CLI wrapper around scripts/lib/matrix-check.mjs. Exits non-zero if the
// UI-capture matrix violates any gate (completeness, redirect, page errors,
// or undifferentiated cells).

import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkMatrix } from "./lib/matrix-check.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.OUT_DIR
  ? resolve(process.env.OUT_DIR)
  : join(resolve(__dirname, ".."), "artifacts", "ui-capture", "after");

const { ok, violations, summary } = checkMatrix(OUT_DIR);

console.log(`[verify-screenshot-matrix] ${OUT_DIR}`);
console.log(`  shots: ${summary.shotCount}/${summary.expectedCount} expected`);
console.log(`  cells checked: ${summary.cellsChecked}, differentiated: ${summary.distinctCells}`);
console.log(`  gated routes (exempt): ${summary.gatedRoutes?.join(", ") || "none"}`);

if (!ok) {
  console.error(`[verify-screenshot-matrix] FAILED with ${violations.length} violation(s):`);
  for (const v of violations) {
    console.error(`  - ${JSON.stringify(v)}`);
  }
  process.exitCode = 1;
} else {
  console.log("[verify-screenshot-matrix] OK — matrix is complete and differentiated.");
}
