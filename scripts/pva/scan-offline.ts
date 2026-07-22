import { readFileSync, readdirSync } from "fs";
import path from "path";
import { validateEfdOffline } from "@/modules/obligations/efd-icms-ipi/layouts/020";

const dir = path.join(process.cwd(), "docs", "pva", "2026-06", "generation-2");
const files = readdirSync(dir).filter((f) => f.startsWith("efd-") && f.endsWith(".txt"));

const ruleCounts: Record<string, number> = {};
const enumByRecord: Record<string, number> = {};
let filesWithErrors = 0;
const clean: string[] = [];

for (const f of files) {
  const content = readFileSync(path.join(dir, f), "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  const issues = validateEfdOffline({ lines }).filter((i) => i.severity === "error");
  if (issues.length === 0) {
    clean.push(f);
    continue;
  }
  filesWithErrors++;
  for (const i of issues) {
    ruleCounts[i.rule] = (ruleCounts[i.rule] ?? 0) + 1;
    if (i.rule === "EFD_ENUM") enumByRecord[i.recordCode] = (enumByRecord[i.recordCode] ?? 0) + 1;
  }
}

console.log("TOTAL FILES:", files.length);
console.log("FILES WITH ERRORS:", filesWithErrors);
console.log("CLEAN FILES:", clean.length);
console.log("RULE COUNTS:", JSON.stringify(ruleCounts, null, 2));
console.log("ENUM BY RECORD:", JSON.stringify(enumByRecord, null, 2));
if (clean.length) console.log("FIRST CLEAN:", clean.slice(0, 5).join(", "));
