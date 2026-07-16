import { readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";
import { validateEfdOffline } from "@/modules/obligations/efd-icms-ipi/layouts/020";
import { EFD_ICMS_IPI_LAYOUT_2026 } from "@/modules/obligations/efd-icms-ipi/constants";

/**
 * Gera evidência sanitizada (sem PII) da geração em lote.
 * Lê os arquivos efd-*.txt e o companies-summary.csv, roda o validador
 * offline de leiaute 020 em todos e produz manifest.sanitized.json.
 */

const dir = path.join(process.cwd(), "docs", "pva", "2026-06", "generation-2");

function main() {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("efd-") && f.endsWith(".txt"))
    .sort();
  const ruleCounts: Record<string, number> = {};
  let errorCount = 0;
  let fileCount = 0;
  for (const f of files) {
    const content = readFileSync(path.join(dir, f), "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    fileCount += 1;
    for (const issue of validateEfdOffline({ lines })) {
      if (issue.severity === "error") errorCount += 1;
      ruleCounts[issue.rule] = (ruleCounts[issue.rule] || 0) + 1;
    }
  }

  const csvPath = path.join(dir, "companies-summary.csv");
  let companies = 0;
  const ufCounts: Record<string, number> = {};
  let totalNFe = 0;
  let totalRecords = 0;
  if (readFileSync(csvPath, "utf8")) {
    const rows = readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
    // Colunas fixas; o campo `name` pode conter ";" (não citado), então
    // lemos UF/NFe/records a partir da DIREITA (status,hash,blocks,records,
    // numNFe,codMun,ie,uf = 8ª a partir do fim).
    for (let i = 1; i < rows.length; i++) {
      const c = rows[i].split(";");
      if (c.length < 10) continue;
      companies += 1;
      const uf = c[c.length - 8] || "??";
      ufCounts[uf] = (ufCounts[uf] || 0) + 1;
      totalNFe += Number(c[c.length - 5] || 0);
      totalRecords += Number(c[c.length - 4] || 0);
    }
  }

  const manifest = {
    sanitized: true,
    containsPii: false,
    obligationId: "efd-icms-ipi",
    layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    period: "2026-06",
    generatedAt: new Date().toISOString(),
    generation: {
      files: fileCount,
      companies,
      distinctUf: Object.keys(ufCounts).length,
      ufCounts,
      totalNFe,
      totalRecords,
      // Todos os 300 CNPJs gerados com activityCode padrão "0" (não industrial),
      // perfis de cadastro assumidos via fixture sanitizada (ver HANDOFF).
      activityAssumption: "0 (não industrial) para todos — cadastro real fica para PR4",
    },
    offlineValidation: {
      tool: "validateEfdOffline (layout 020)",
      filesChecked: fileCount,
      errorCount,
      ruleCounts,
      result: errorCount === 0 ? "PASS" : "FAIL",
    },
    disclaimer:
      "Evidência de pré-validação interna. Não substitui o PVA oficial (v6.1.0, GUI), assinatura ou transmissão. Não constitui parecer fiscal. Sem dados pessoais: CNPJ/nome/IE permaneceram apenas nos arquivos .txt gitignored.",
  };

  const out = path.join(dir, "manifest.sanitized.json");
  writeFileSync(out, JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main();
