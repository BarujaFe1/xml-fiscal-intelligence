/**
 * Anonymize fiscal XML files for safe sharing.
 *
 * Usage:
 *   npx tsx scripts/anonymize-xml.ts input.xml output.xml
 *
 * Replaces CNPJ/CPF-like digit sequences with deterministic fake docs.
 * Does NOT guarantee full anonymization of free-text fields — review before publishing.
 */
import fs from "fs";
import path from "path";

function fakeCnpj(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const base = String(10000000000000 + (h % 89999999999999)).padStart(14, "0");
  return base;
}

function anonymize(xml: string) {
  let out = xml;
  // CNPJ 14 digits
  out = out.replace(/\b(\d{14})\b/g, (_, digits: string) => fakeCnpj(digits));
  // CPF 11 digits (avoid breaking dates by requiring not preceded by -)
  out = out.replace(/(?<![\d-])\b(\d{11})\b(?!\d)/g, "39053344705");
  // common name tags
  out = out.replace(/<(xNome|RazaoSocial|xFant)>([^<]*)</g, "<$1>EMPRESA ANONIMIZADA</");
  out = out.replace(/<(xLgr|Endereco)>([^<]*)</g, "<$1>Rua Anonimizada</");
  return out;
}

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("Usage: npx tsx scripts/anonymize-xml.ts <input.xml> <output.xml>");
  process.exit(1);
}

const xml = fs.readFileSync(path.resolve(input), "utf8");
fs.writeFileSync(path.resolve(output), anonymize(xml), "utf8");
console.log(`Anonymized -> ${output}`);
