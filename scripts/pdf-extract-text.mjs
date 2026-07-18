// Utilitário local: extrai texto de um PDF usando pdfjs-dist (legacy build).
// Uso: tsx scripts/pdf-extract-text.mjs <input.pdf> <output.txt>
// Somente leitura da fonte; grava TXT para auditoria/reconciliação de leiaute.
import { readFileSync, writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("uso: tsx scripts/pdf-extract-text.mjs <input.pdf> <output.txt>");
  process.exit(1);
}

const data = new Uint8Array(readFileSync(inPath));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const out = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  let last = null;
  let line = "";
  const lines = [];
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const y = item.transform[5];
    if (last !== null && Math.abs(y - last) > 2) {
      lines.push(line);
      line = "";
    }
    line += item.str;
    if (item.hasEOL) {
      lines.push(line);
      line = "";
    }
    last = y;
  }
  if (line) lines.push(line);
  out.push(`\n===== PAGE ${p} =====\n` + lines.join("\n"));
}
writeFileSync(outPath, out.join("\n"), "utf8");
console.log(`OK: ${doc.numPages} páginas → ${outPath}`);
