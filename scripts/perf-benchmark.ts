/**
 * Local PERF-001 micro-benchmark: synthesize N NF-e XMLs into a ZIP and time import.
 * Usage: npx tsx scripts/perf-benchmark.ts [xmlCount]
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import JSZip from "jszip";
import { processZipBatchInMemory } from "../src/lib/store/process-memory";

function sampleNfe(n: number): string {
  const key = `3526011122233300018155001${String(n).padStart(9, "0")}112345678901`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe Id="NFe${key.slice(0, 44)}" versao="4.00">
    <ide><cUF>35</cUF><mod>55</mod><serie>1</serie><nNF>${n}</nNF>
      <dhEmi>2026-07-01T10:00:00-03:00</dhEmi><tpNF>1</tpNF><tpAmb>2</tpAmb>
    </ide>
    <emit><CNPJ>11222333000181</CNPJ><xNome>BENCH EMIT</xNome><enderEmit><UF>SP</UF></enderEmit></emit>
    <dest><CNPJ>11222333000181</CNPJ><xNome>BENCH DEST</xNome></dest>
    <det nItem="1"><prod><cProd>1</cProd><xProd>Item ${n}</xProd><NCM>84713012</NCM><CFOP>5102</CFOP>
      <qCom>1.0000</qCom><vUnCom>10.00</vUnCom><vProd>10.00</vProd></prod>
      <imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>10.00</vBC><pICMS>18.00</pICMS><vICMS>1.80</vICMS></ICMS00></ICMS></imposto>
    </det>
    <total><ICMSTot><vProd>10.00</vProd><vNF>10.00</vNF><vICMS>1.80</vICMS></ICMSTot></total>
  </infNFe></NFe>
</nfeProc>`;
}

async function main() {
  const count = Math.max(1, Number(process.argv[2] || 100));
  const zip = new JSZip();
  for (let i = 1; i <= count; i++) {
    zip.file(`nfe-${String(i).padStart(5, "0")}.xml`, sampleNfe(i));
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const outDir = path.join(process.cwd(), "private-data", "perf");
  mkdirSync(outDir, { recursive: true });
  const zipPath = path.join(outDir, `bench-${count}.zip`);
  writeFileSync(zipPath, buffer);

  const t0 = performance.now();
  const { store } = await processZipBatchInMemory({
    buffer,
    fileName: `bench-${count}.zip`,
    name: `perf-${count}`,
    keepRawJson: false,
    keepFields: false,
    incremental: false,
  });
  const ms = performance.now() - t0;

  const row = {
    date: new Date().toISOString().slice(0, 10),
    workload: `W-synth-${count}`,
    docs: store.documents.length,
    zipBytes: buffer.length,
    t_total_s: Number((ms / 1000).toFixed(3)),
    notes: `local processZipBatchInMemory; zip=${zipPath}`,
  };
  console.log(JSON.stringify(row, null, 2));

  const mdPath = path.join(process.cwd(), "docs", "PERF_BENCHMARK.md");
  const { readFileSync, writeFileSync: wf } = await import("fs");
  let md = readFileSync(mdPath, "utf8");
  const line = `| ${row.date} | local | ${row.workload} | ${row.docs} | ${row.t_total_s} | ${row.notes} |`;
  if (md.includes("| — | — | W1 |")) {
    md = md.replace("| — | — | W1 | — | — | pending |", `${line}\n| — | — | W1 | — | — | pending |`);
  } else if (!md.includes(row.workload)) {
    md = md.replace(
      "## Out of scope here",
      `${line}\n\n## Out of scope here`,
    );
  }
  wf(mdPath, md);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
