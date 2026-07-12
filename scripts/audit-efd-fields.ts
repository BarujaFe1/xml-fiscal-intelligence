import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { processZipBatchInMemory } from "../src/lib/store/process-memory";
import { generateObligationLocal } from "../src/modules/obligations/generate-local";
import { DEMO_ESTABLISHMENT } from "../src/modules/obligations/demo-fixtures";

const EXPECTED: Record<string, number> = {
  "0000": 15,
  "0001": 2,
  "0005": 10,
  "0100": 14,
  "0150": 13,
  "0190": 3,
  "0200": 13,
  "0990": 2,
  B001: 2,
  B990: 2,
  C001: 2,
  C100: 29,
  C170: 38,
  C190: 12,
  C990: 2,
  D001: 2,
  D990: 2,
  E001: 2,
  E100: 3,
  E110: 15,
  E990: 2,
  G001: 2,
  G990: 2,
  H001: 2,
  H990: 2,
  K001: 2,
  K990: 2,
  "1001": 2,
  "1010": 14,
  "1990": 2,
  "9001": 2,
  "9900": 3,
  "9990": 2,
  "9999": 2,
};

async function main() {
  const zip = path.join(process.env.USERPROFILE || "", "Downloads", "202606 NFe.zip");
  const buf = readFileSync(zip);
  console.log("importing zip…");
  const store = await processZipBatchInMemory({
    buffer: buf,
    fileName: "z.zip",
    name: "t",
    month: 6,
    year: 2026,
    keepRawJson: false,
    keepFields: false,
    incremental: false,
  });
  console.log("docs", store.documents.length, "items", store.items.length);
  const out = await generateObligationLocal({
    obligationId: "efd-icms-ipi",
    store,
    establishment: {
      ...DEMO_ESTABLISHMENT,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      activityCode: "1",
    },
  });
  const lines = (out.content || "").split(/\r?\n/).filter(Boolean);
  const byReg = new Map<string, number>();
  const mismatchCount = new Map<string, number>();
  const samples: string[] = [];
  let pipeInText = 0;
  let emptyCst = 0;
  let badChv = 0;

  for (const line of lines) {
    const fields = line.replace(/^\|/, "").replace(/\|$/, "").split("|");
    const reg = fields[0] || "?";
    byReg.set(reg, (byReg.get(reg) || 0) + 1);
    for (let i = 1; i < fields.length; i++) {
      if ((fields[i] || "").includes("|")) pipeInText += 1;
    }
    const exp = EXPECTED[reg];
    if (exp != null && fields.length !== exp) {
      mismatchCount.set(reg, (mismatchCount.get(reg) || 0) + 1);
      if (samples.length < 20) {
        samples.push(`${reg}: got ${fields.length} exp ${exp} :: ${line.slice(0, 140)}`);
      }
    }
    if (reg === "C170" && !(fields[9] || "").trim()) emptyCst += 1;
    if (reg === "C100") {
      const chv = fields[8] || "";
      if (chv && chv.length !== 44) badChv += 1;
    }
  }

  console.log("lines", lines.length);
  console.log("byReg", Object.fromEntries([...byReg.entries()].sort()));
  console.log("mismatchByReg", Object.fromEntries(mismatchCount));
  console.log("samples", samples);
  console.log({ pipeInText, emptyCst, badChv, error: out.error });

  const dir = path.join("private-exports", "probe-efd-fix");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "efd.txt"), out.content || "", "utf8");
  console.log("wrote", dir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
