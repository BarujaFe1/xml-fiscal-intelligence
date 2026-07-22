/**
 * Generation-2 — one EFD ICMS/IPI per company discovered in the NFe batch.
 *
 * The batch (e.g. 202606 NFe.zip) mixes NFe from many CNPJs. For each distinct
 * company (emitente OU destinatário), we extract its cadastro (IE/COD_MUN/UF/nome
 * from its own NFe) and generate its EFD from the NFe where it is emitente ou dest.
 *
 * Output: docs/pva/2026-06/generation-2/efd-<cnpj>.txt  (+ manifest + companies-summary.csv)
 *
 * Env: INPUT_DIR, OUT_DIR, PERIOD_START, PERIOD_END
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

function block(xml: string, tag: string): string | null {
  const open = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>`, "i");
  const m = open.exec(xml);
  if (!m) return null;
  const start = m.index + m[0].length;
  const close = new RegExp(`</(?:\\w+:)?${tag}>`, "i");
  const c = close.exec(xml.slice(start));
  if (!c) return null;
  return xml.slice(start, start + c.index);
}
function tagVal(b: string | null, tag: string): string {
  if (!b) return "";
  const m = new RegExp(`<(?:\\w+:)?${tag}\\s*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i").exec(b);
  return m ? m[1].trim() : "";
}
function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

interface CompanyData {
  cnpj: string;
  ie?: string;
  codMun?: string;
  uf?: string;
  name?: string;
  cep?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  phone?: string;
  email?: string;
}
function extractParty(xml: string, tag: string): CompanyData | null {
  const b = block(xml, tag);
  if (!b) return null;
  const cnpj = onlyDigits(tagVal(b, "CNPJ"));
  if (!cnpj) return null;
  return {
    cnpj,
    ie: tagVal(b, "IE"),
    codMun: onlyDigits(tagVal(b, "cMun")).slice(0, 7),
    uf: tagVal(b, "UF"),
    name: tagVal(b, "xNome"),
    cep: onlyDigits(tagVal(b, "CEP")).slice(0, 8),
    address: tagVal(b, "xLgr"),
    number: tagVal(b, "nro"),
    neighborhood: tagVal(b, "xBairro"),
    phone: onlyDigits(tagVal(b, "fone")).slice(0, 11),
    email: tagVal(b, "email"),
  };
}

async function main() {
  const inputDir = env("INPUT_DIR", path.join(process.cwd(), "docs", "pva", "2026-06", "inputs"));
  const outDir = env("OUT_DIR", path.join(process.cwd(), "docs", "pva", "2026-06", "generation-2"));
  const periodStart = env("PERIOD_START", "2026-06-01");
  const periodEnd = env("PERIOD_END", "2026-06-30");

  const files = readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith(".xml"))
    .sort();
  console.log("scanning", files.length, "xml files for companies...");

  const companies = new Map<string, { emit: CompanyData | null; dest: CompanyData | null; files: string[] }>();
  const rawByFile = new Map<string, string>();
  const see = (cnpj: string, src: "emit" | "dest", data: CompanyData, file: string) => {
    let c = companies.get(cnpj);
    if (!c) {
      c = { emit: null, dest: null, files: [] };
      companies.set(cnpj, c);
    }
    c[src] = mergeParty(c[src], data);
    if (!c.files.includes(file)) c.files.push(file);
  };
  function mergeParty(prev: CompanyData | null, data: CompanyData): CompanyData {
    if (!prev) return data;
    const out: CompanyData = { ...prev };
    for (const k of Object.keys(data) as (keyof CompanyData)[]) {
      const v = data[k];
      if (v && !out[k]) out[k] = v;
    }
    return out;
  }

  for (const f of files) {
    const xml = readFileSync(path.join(inputDir, f), "utf8");
    rawByFile.set(f, xml);
    const emit = extractParty(xml, "emit");
    const dest = extractParty(xml, "dest");
    if (emit) see(emit.cnpj, "emit", emit, f);
    if (dest) see(dest.cnpj, "dest", dest, f);
  }
  console.log("distinct companies:", companies.size);

  mkdirSync(outDir, { recursive: true });
  const summary: string[] = ["cnpj;name;uf;ie;codMun;numNFe;records;blocks;hash;status"];
  let okCount = 0;

  for (const [cnpj, c] of [...companies.entries()].sort()) {
    const info = c.emit || c.dest!;
    const docs: unknown[] = [];
    const items: unknown[] = [];
    let parsed = 0;
    for (const f of c.files) {
      try {
        const p = parseXmlDocument({
          xml: rawByFile.get(f)!,
          fileName: f,
          batchId: "gen2",
          workspaceId: "ws_gen2",
        });
        docs.push(p.document);
        for (const it of p.items) items.push(it);
        parsed++;
      } catch {
        /* skip unparseable */
      }
    }

    const establishment = {
      workspaceId: "ws_gen2",
      companyId: "co_" + cnpj,
      establishmentId: "est_" + cnpj,
      cnpj,
      ie: info.ie || "123456789012",
      uf: info.uf || "SP",
      companyName: info.name || cnpj,
      profile: "A" as const,
      activityCode: "0",
      purpose: "0" as const,
      periodStart,
      periodEnd,
      codMun: info.codMun || "3550308",
      cep: info.cep || "01001000",
      address: info.address || "RUA EXEMPLO",
      addressNumber: info.number || "100",
      neighborhood: info.neighborhood || "CENTRO",
      phone: info.phone || "1133334444",
      email: info.email || "contato@empresa.com.br",
      accountantName: "Contador",
      accountantCpf: "52998224725",
      accountantCrc: "SP123456/O",
      accountantEmail: env("ACCOUNTANT_EMAIL", "contador@exemplo.com.br"),
      cnae: env("CNAE", "4623107"),
      cnaeDescription: env("CNAE_DESC", ""),
      industrialClass: env("INDUSTRIAL_CLASS", "02"),
      layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    };

    try {
      const context = buildObligationContextFromBatch({
        establishment: establishment as never,
        documents: docs as never,
        items: items as never,
      });
      const readiness = await efdIcmsIpiPlugin.detectRequiredData(context);
      if (!readiness.canGenerate) {
        summary.push(`${cnpj};${info.name || ""};${info.uf || ""};${info.ie || ""};${info.codMun || ""};${c.files.length};0;;;blocked`);
        console.log("  SKIP", cnpj, "blocked:", readiness.blockingCount);
        continue;
      }
      const build = await efdIcmsIpiPlugin.build(context);
      const validation = await efdIcmsIpiPlugin.validate(build, context);
      const serialized = await efdIcmsIpiPlugin.serialize(build, context);
      const manifest = await efdIcmsIpiPlugin.createManifest(build, serialized, context, validation);

      const txtPath = path.join(outDir, `efd-${cnpj}.txt`);
      const sha = createHash("sha256").update(serialized.content, "utf8").digest("hex");
      writeFileSync(txtPath, serialized.content, "utf8");
      writeFileSync(
        path.join(outDir, `efd-${cnpj}.manifest.json`),
        JSON.stringify(manifest, null, 2),
        "utf8",
      );

      const regs: Record<string, number> = {};
      for (const line of serialized.content.split(/\r?\n/)) {
        const m = line.match(/^\|([0-9A-Z]{4})\|/);
        if (m) regs[m[1]] = (regs[m[1]] || 0) + 1;
      }
      const blocks = [...new Set(Object.keys(regs).map((r) => r[0]))].sort().join("");
      summary.push(
        `${cnpj};${info.name || ""};${info.uf || ""};${info.ie || ""};${info.codMun || ""};${c.files.length};${serialized.recordCount};${blocks};${sha.slice(0, 12)};ok`,
      );
      okCount++;
    } catch (e) {
      summary.push(`${cnpj};${info.name || ""};${info.uf || ""};${info.ie || ""};${info.codMun || ""};${c.files.length};0;;;error`);
      console.log("  ERROR", cnpj, (e as Error).message);
    }
  }

  writeFileSync(path.join(outDir, "companies-summary.csv"), summary.join("\n") + "\n", "utf8");
  console.log(`done. companies: ${companies.size}, generated: ${okCount}`);
  console.log("summary:", path.join(outDir, "companies-summary.csv"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
