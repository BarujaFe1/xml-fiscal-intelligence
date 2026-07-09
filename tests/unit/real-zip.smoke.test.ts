import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { processZipBatchInMemory } from "@/lib/store/process-memory";

const realZip = path.join(process.env.USERPROFILE || "", "Downloads", "202606 NFe.zip");

describe("real ZIP smoke (local only)", () => {
  it("processes 202606 NFe.zip when present", async () => {
    if (!fs.existsSync(realZip)) {
      console.warn("skip: real zip not found");
      return;
    }
    const buffer = fs.readFileSync(realZip);
    const store = await processZipBatchInMemory({
      buffer,
      fileName: "202606 NFe.zip",
      month: 6,
      year: 2026,
      keepRawJson: false,
      keepFields: false,
    });
    expect(store.batch.totalXml).toBeGreaterThan(0);
    expect(store.batch.validXml + store.batch.invalidXml).toBe(store.documents.length);
    expect(store.batch.nfeCount + store.batch.cteCount + store.batch.nfseCount + store.batch.unknownCount).toBe(
      store.documents.length,
    );
    console.log({
      totalXml: store.batch.totalXml,
      valid: store.batch.validXml,
      nfe: store.batch.nfeCount,
      items: store.items.length,
      score: store.batch.healthScore,
      totalValue: store.batch.totalValue,
    });
  }, 120_000);
});
