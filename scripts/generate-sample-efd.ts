/**
 * Generate a sample EFD ICMS/IPI TXT from anonymized NF-e for PVA import testing.
 * Output: private-exports/efd-sample-*.txt + .manifest.json (gitignored content ok under private-exports)
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { parseXmlDocument } from "../src/lib/parser";
import {
  EFD_ICMS_IPI_LAYOUT_2026,
  efdIcmsIpiPlugin,
  buildObligationContextFromBatch,
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
      cnpj: "12345678000190",
      ie: "123456789012",
      uf: "SP",
      companyName: "EMPRESA DEMO EMITENTE LTDA",
      profile: "A",
      activityCode: "0",
      purpose: "0",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      accountantName: "Contador Demo",
      accountantCpf: "12345678901",
      layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    },
    documents: [parsed.document],
    items: parsed.items,
  });

  const readiness = await efdIcmsIpiPlugin.detectRequiredData(context);
  if (!readiness.canGenerate) {
    console.error("Blocked", readiness);
    process.exit(1);
  }

  const build = await efdIcmsIpiPlugin.build(context);
  const validation = await efdIcmsIpiPlugin.validate(build, context);
  const serialized = await efdIcmsIpiPlugin.serialize(build, context);
  const manifest = await efdIcmsIpiPlugin.createManifest(
    build,
    serialized,
    context,
    validation,
  );

  const outDir = path.join(process.cwd(), "private-exports");
  mkdirSync(outDir, { recursive: true });
  const base = `efd-sample-${serialized.contentHash.slice(0, 12)}`;
  const txtPath = path.join(outDir, `${base}.txt`);
  const manPath = path.join(outDir, `${base}.manifest.json`);
  const pvaPath = path.join(outDir, `${base}.PVA_RESULT.pending.md`);

  writeFileSync(txtPath, serialized.content, "utf8");
  writeFileSync(manPath, JSON.stringify(manifest, null, 2), "utf8");
  writeFileSync(
    pvaPath,
    `# PVA validation pending

1. Abra o PVA EFD ICMS/IPI oficial (download Receita/SPED).
2. Importe: \`${base}.txt\`
3. Anote a versão do PVA usada.
4. Salve o relatório do PVA neste diretório como \`${base}.pva-report.txt\`
5. Marque status em obligation_generations / pva_validation_runs quando o SaaS estiver no ar.

Hash do arquivo: \`${serialized.contentHash}\`
Validação interna nível 1: ${validation.ok ? "ok (com warnings possíveis)" : "falhou"}

**Não** trate validação interna como validação oficial.
`,
    "utf8",
  );

  console.log("Wrote", txtPath);
  console.log("Wrote", manPath);
  console.log("Wrote", pvaPath);
  console.log("records", serialized.recordCount, "hash", serialized.contentHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
