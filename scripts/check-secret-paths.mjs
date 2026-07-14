// scripts/check-secret-paths.mjs — CI-friendly path scan (no network)
// Exit 1 if tracked paths look like secrets (heuristic).

import { execSync } from "node:child_process";

const SUSPICIOUS = [/\/\.env($|\.)/i, /credentials\.json$/i, /private.*key/i];

let files = [];
try {
  files = execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
} catch {
  console.error("git ls-files failed — skip in non-git env");
  process.exit(0);
}

const hits = files.filter((f) => {
  const n = f.replace(/\\/g, "/");
  if (n.startsWith("docs/") && n.includes("DPA")) return false;
  if (n.includes("secrets-guard")) return false;
  if (n.includes("check-secret-paths")) return false;
  return SUSPICIOUS.some((re) => re.test(n));
});

if (hits.length) {
  console.error("Possible secret paths tracked:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(`secret-path scan ok (${files.length} tracked files)`);
