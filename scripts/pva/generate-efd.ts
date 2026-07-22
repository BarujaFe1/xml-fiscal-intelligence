/**
 * Generation-2 EFD ICMS/IPI generator for the PVA validation loop.
 *
 * Reads NF-e/NFCE XMLs from an input folder, builds the obligation context,
 * serializes the EFD TXT, and writes it (plus manifest + SHA-256) under
 * docs/pva/2026-06/generation-2 for import into the official PVA.
 *
 * Env:
 *   INPUT_DIR     folder with *.xml (default: samples/anonymized)
 *   PERIOD_START  YYYY-MM-DD (default 2026-06-01)
 *   PERIOD_END    YYYY-MM-DD (default 2026-06-30)
 *   CNPJ, IE, UF, COMPANY, PROFILE, PURPOSE  establishment overrides
 *   OUT_DIR       output folder (default docs/pva/2026-06/generation-2)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import { createHash } from "crypto";
import { parseXmlDocument } from "../../src/lib/parser";
import {
  EFD_ICMS_IPI_LAYOUT_2026,
  efdIcmsIpiPlugin,
  buildObligationContextFromBatch,
} from "../../src/modules/obligations";

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

async function main() {
  const inputDir = env("INPUT_DIR", path.join(process.cwd(), "samples", "anonymized"));
  const outDir = env("OUT_DIR", path.join(process.cwd(), "docs", "pva", "2026-06", "generation-2"));
  const periodStart = env("PERIOD_START", "2026-06-01");
  const periodEnd = env("PERIOD_END", "2026-06-30");

  const files = readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith(".xml"))
    .sort();
  if (!files.length) {
    console.error("No .xml files in", inputDir);
    process.exit(1);
  }

  const documents: unknown[] = [];
  const items: unknown[] = [];
  for (const f of files) {
    const xml = readFileSync(path.join(inputDir, f), "utf8");
    const parsed = parseXmlDocument({
      xml,
      fileName: f,
      batchId: "gen2",
      workspaceId: "ws_gen2",
    });
    documents.push(parsed.document);
    for (const it of parsed.items) items.push(it);
  }

  const context = buildObligationContextFromBatch({
    establishment: {
      workspaceId: "ws_gen2",
      companyId: "co_gen2",
      establishmentId: "est_gen2",
      cnpj: env("CNPJ", "11222333000181"),
      ie: env("IE", "123456789012"),
      uf: env("UF", "SP"),
      companyName: env("COMPANY", "EMPRESA DEMO EMITENTE LTDA"),
      profile: (env("PROFILE", "A") as "A" | "B" | "C"),
      activityCode: env("ACTIVITY", "0"),
      purpose: (env("PURPOSE", "0") as "0" | "1"),
      periodStart,
      periodEnd,
      codMun: env("COD_MUN", "3550308"),
      cep: env("CEP", "01001000"),
      address: env("ADDRESS", "RUA EXEMPLO"),
      addressNumber: env("NUMBER", "100"),
      addressCompl: env("COMPL", ""),
      neighborhood: env("NEIGHBORHOOD", "CENTRO"),
      phone: env("PHONE", "1133334444"),
      email: env("EMAIL", "contato@empresa.com.br"),
      accountantName: env("ACCOUNTANT", "Contador Demo"),
      accountantCpf: env("ACCOUNTANT_CPF", "52998224725"),
      accountantCrc: env("ACCOUNTANT_CRC", "SP123456/O"),
      accountantEmail: env("ACCOUNTANT_EMAIL", "contador@exemplo.com.br"),
      cnae: env("CNAE", "4623107"),
      cnaeDescription: env("CNAE_DESC", ""),
      industrialClass: env("INDUSTRIAL_CLASS", "02"),
      layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    },
    documents: documents as never,
    items: items as never,
  });

  const readiness = await efdIcmsIpiPlugin.detectRequiredData(context);
  if (!readiness.canGenerate) {
    console.error("Blocked by readiness:", JSON.stringify(readiness, null, 2));
    process.exit(1);
  }

  const build = await efdIcmsIpiPlugin.build(context);
  const validation = await efdIcmsIpiPlugin.validate(build, context);
  const serialized = await efdIcmsIpiPlugin.serialize(build, context);
  const manifest = await efdIcmsIpiPlugin.createManifest(build, serialized, context, validation);

  mkdirSync(outDir, { recursive: true });
  const sha = createHash("sha256").update(serialized.content, "utf8").digest("hex");
  const base = `efd-generated-2-${sha.slice(0, 12)}`;
  const txtPath = path.join(outDir, "efd-generated-2.txt");
  const shaPath = path.join(outDir, "SHA256SUMS.txt");
  const manPath = path.join(outDir, "manifest.json");
  const pvaPath = path.join(outDir, "PVA_RESULT.pending.md");

  writeFileSync(txtPath, serialized.content, "utf8");
  writeFileSync(shaPath, `${sha}  efd-generated-2.txt\n`, "utf8");
  writeFileSync(manPath, JSON.stringify(manifest, null, 2), "utf8");
  writeFileSync(
    pvaPath,
    `# PVA validation pending (Generation-2)

1. Abra o PVA EFD ICMS/IPI oficial (v6.1.0).
2. Importe: \`efd-generated-2.txt\`
3. Valide e salve o relatório como \`pva-relatorio.txt\` nesta pasta.
4. Informe os erros (Registro/Campo/Linha/Regra/Valor + mensagem).

Arquivos de entrada: ${files.join(", ")}
Período: ${periodStart} a ${periodEnd}
Hash SHA-256: \`${sha}\`
Validação interna nível 1: ${validation.ok ? "ok (com warnings possíveis)" : "falhou"}
**Não** trate validação interna como validação oficial.
`,
    "utf8",
  );

  // Block breakdown for quick triage.
  const counts: Record<string, number> = {};
  for (const line of serialized.content.split(/\r?\n/)) {
    const m = line.match(/^\|(\d{4})\|/);
    if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  const blocks = new Set(Object.keys(counts).map((r) => r[0]));
  console.log("inputs:", files.join(", "));
  console.log("records:", serialized.recordCount, "blocks:", [...blocks].sort().join(""));
  console.log("hash:", sha);
  console.log("wrote:", txtPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
