/**
 * Generate sample outputs for all obligation plugins (demo artifacts).
 * npm run obligations:demo-samples
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { parseXmlDocument } from "../src/lib/parser";
import {
  buildObligationContextFromBatch,
  obligationPlugins,
  runObligationPlugin,
  type ObligationId,
  EFD_ICMS_IPI_LAYOUT_2026,
} from "../src/modules/obligations";

async function main() {
  const xml = readFileSync(
    path.join(process.cwd(), "samples", "anonymized", "nfe-example.xml"),
    "utf8",
  );
  const parsed = parseXmlDocument({
    xml,
    fileName: "nfe-example.xml",
    batchId: "sample",
    workspaceId: "ws_sample",
  });
  const context = buildObligationContextFromBatch({
    establishment: {
      workspaceId: "ws_sample",
      companyId: "co_sample",
      establishmentId: "est_sample",
      cnpj: "11222333000181",
      ie: "123456789012",
      uf: "SP",
      companyName: "EMPRESA DEMO EMITENTE LTDA",
      profile: "A",
      activityCode: "0",
      purpose: "0",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      accountantName: "Contador Demo",
      accountantCpf: "39053344705",
      layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    },
    documents: [parsed.document],
    items: parsed.items,
  });

  const outDir = path.join(process.cwd(), "private-exports", "obligations-demo");
  mkdirSync(outDir, { recursive: true });

  for (const id of Object.keys(obligationPlugins) as ObligationId[]) {
    const plugin = obligationPlugins[id];
    const layoutVersion = (await plugin.resolveVersion(context)).layoutVersion;
    const out = await runObligationPlugin(plugin, { ...context, layoutVersion });
    if (!out.serialized) {
      console.error(id, "BLOCKED", out.readiness);
      continue;
    }
    const ext = id === "reinf" ? "json" : "txt";
    const file = path.join(outDir, `${id}.${ext}`);
    writeFileSync(file, out.serialized.content, "utf8");
    writeFileSync(
      path.join(outDir, `${id}.manifest.json`),
      JSON.stringify(out.manifest, null, 2),
      "utf8",
    );
    console.log(id, "ok", out.serialized.recordCount, "->", file);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
