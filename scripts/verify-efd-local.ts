import { readFileSync } from "fs";
import path from "path";
import { processZipBatchInMemory } from "../src/lib/store/process-memory";
import { generateObligationLocal } from "../src/modules/obligations/generate-local";

async function main() {
  const zip = path.join(process.env.USERPROFILE || "", "Downloads", "202606 NFe.zip");
  const buffer = readFileSync(zip);
  const { store: s } = await processZipBatchInMemory({
    buffer,
    fileName: "202606 NFe.zip",
    name: "202606",
    month: 6,
    year: 2026,
    keepRawJson: false,
    keepFields: false,
    incremental: false,
  });
  console.log("docs", s.documents.length);
  const t0 = performance.now();
  const out = await generateObligationLocal({
    obligationId: "efd-icms-ipi",
    store: s,
    establishment: {
      cnpj: (s.documents[0]?.emitterDoc || "11222333000181").replace(/\D/g, "").slice(0, 14),
      ie: "123456789012",
      uf: s.documents[0]?.emitterUf || "SP",
      companyName: s.documents[0]?.emitterName || "PROBE",
      profile: "A",
      activityCode: "0",
      purpose: "0",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      accountantName: "Contador",
      accountantCpf: "39053344705",
    },
  });
  console.log({
    error: out.error || null,
    records: out.recordCount,
    ms: Math.round(performance.now() - t0),
    hash: out.contentHash?.slice(0, 12),
    starts: out.content?.slice(0, 40),
  });
  if (out.error && !out.content) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
