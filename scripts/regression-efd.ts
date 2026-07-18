/**
 * Harness de regressão EFD ICMS/IPI com dados reais.
 *
 * Itera todos os períodos em private-imports/nfe/<AAAAMM>/, escopa por CNPJ
 * (default: cooperativa 03585024000490 / SP), gera a EFD do mês, roda o
 * validador offline (leiaute 020) e coleta a distribuição de contagem de campos.
 *
 * Saídas .txt (dado fiscal real) vão para OUT_DIR gitignored.
 * Um resumo SANITIZADO (só contagens/issues, sem PII) é impresso e gravado em
 * docs/pva/REGRESSION_COOP_SP.md.
 *
 * Uso: tsx --tsconfig tsconfig.json scripts/regression-efd.ts
 *   env: CNPJ (default 03585024000490), UF (default SP), COD_REC (default 046-2),
 *        BASE_DIR (default private-imports/nfe), OUT_DIR (default private-exports/efd-regression)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import {
  buildObligationContextFromBatch,
  efdIcmsIpiPlugin,
  filterDocumentsByPeriod,
  runObligationPlugin,
} from "@/modules/obligations";
import { filterStoreByCnpj } from "@/modules/obligations/generate-local";
import type { BatchStore } from "@/types";
import { validateEfdOffline } from "@/modules/obligations/efd-icms-ipi/layouts/020/offline-validator";
import { getRecordDef } from "@/modules/obligations/efd-icms-ipi/layouts/020/records";
import { EFD_ICMS_IPI_LAYOUT_2026 } from "@/modules/obligations/efd-icms-ipi/plugin";

function digits(v?: string | null): string {
  return (v || "").replace(/\D/g, "");
}

function monthBounds(period: string): { start: string; end: string } {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(4, 6));
  const last = new Date(y, m, 0).getDate();
  return {
    start: `${y}-${String(m).padStart(2, "0")}-01`,
    end: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
  };
}

type PeriodResult = {
  period: string;
  filesInDir: number;
  scopedDocs: number;
  inPeriod: number;
  records: number;
  fieldCountOk: boolean;
  fieldDivergences: string[];
  issues: number;
  issuesByRule: Record<string, number>;
  hash: string;
};

async function runPeriod(dir: string, period: string, cnpj: string, uf: string, codRec: string, outDir: string): Promise<PeriodResult | null> {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xml"));
  const documents: any[] = [];
  const items: any[] = [];
  for (const f of files) {
    let xml = "";
    try {
      xml = readFileSync(path.join(dir, f), "utf8");
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = parseXmlDocument({ xml, fileName: f, batchId: "reg", workspaceId: "ws" });
    } catch {
      continue;
    }
    if (!parsed?.document) continue;
    documents.push(parsed.document as any);
    for (const it of parsed.items || []) items.push(it);
  }

  const store: BatchStore = {
    batch: { workspaceId: "ws", id: "reg" } as any,
    documents,
    items,
    fields: [],
    errors: [],
    exports: [],
  };
  const scoped = filterStoreByCnpj(store, cnpj);
  const { start, end } = monthBounds(period);
  const pf = filterDocumentsByPeriod(scoped.documents, start, end);
  if (!scoped.documents.length || !pf.inPeriod.length) {
    return {
      period,
      filesInDir: files.length,
      scopedDocs: scoped.documents.length,
      inPeriod: pf.inPeriod.length,
      records: 0,
      fieldCountOk: true,
      fieldDivergences: [],
      issues: 0,
      issuesByRule: {},
      hash: "-",
    };
  }

  const sample = pf.inPeriod[0] as any;
  const isEmitter = digits(sample.emitterDoc) === digits(cnpj);
  const estab: any = {
    workspaceId: "ws",
    companyId: "co",
    establishmentId: "est",
    cnpj: isEmitter ? sample.emitterDoc || cnpj : sample.receiverDoc || cnpj,
    ie: isEmitter ? sample.emitterIe || "ISENTO" : sample.receiverIe || "ISENTO",
    uf: (isEmitter ? sample.emitterUf : sample.receiverUf) || uf,
    companyName: isEmitter ? sample.emitterName || "ESTAB" : sample.receiverName || "ESTAB",
    profile: "A",
    activityCode: "1",
    purpose: "0",
    periodStart: start,
    periodEnd: end,
    codMun: (isEmitter ? sample.emitterCityCode : sample.receiverCityCode) || "3556503",
    cep: (isEmitter ? sample.emitterCep : sample.receiverCep) || "13880000",
    address: (isEmitter ? sample.emitterAddress : sample.receiverAddress) || "RUA LOCAL",
    addressNumber: "1",
    neighborhood: "CENTRO",
    layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    cnae: sample.cnae || "4623107",
    industrialClass: "02",
    icmsCodRec: codRec,
    accountantName: "Contador Regressao",
    accountantCpf: "52998224725",
    accountantCrc: "SP123456/O",
    accountantEmail: "contador@exemplo.com.br",
  };

  const ctx = buildObligationContextFromBatch({ establishment: estab, documents: pf.inPeriod, items: scoped.items });
  const out: any = await runObligationPlugin(efdIcmsIpiPlugin as any, ctx as any);
  const content: string = out.serialized?.content || "";
  const lines = content.split(/\r?\n/).filter(Boolean);

  const dist: Record<string, Record<number, number>> = {};
  const divergences: string[] = [];
  for (const l of lines) {
    const code = l.replace(/^\|/, "").split("|")[0];
    const n = l.split("|").length - 2;
    dist[code] = dist[code] || {};
    dist[code][n] = (dist[code][n] || 0) + 1;
  }
  for (const code of Object.keys(dist)) {
    const def = getRecordDef(code);
    if (!def) continue;
    for (const k of Object.keys(dist[code])) {
      if (Number(k) !== def.fields.length) {
        divergences.push(`${code}: esperado ${def.fields.length}, veio ${k} (x${dist[code][Number(k)]})`);
      }
    }
  }

  // O validador offline é do leiaute 020 (COD_VER 020, vigente 01/2026). Em
  // períodos pré-2026 o gerador emite COD_VER 019/018 — validá-los contra o
  // leiaute 020 produz EFD_ENUM falso-positivo. Escopamos o offline a 2026+.
  const year = Number((end || "").slice(0, 4));
  const offlineApplies = year >= 2026;
  const issues = offlineApplies ? validateEfdOffline({ lines }) : [];
  const byRule: Record<string, number> = {};
  for (const i of issues) byRule[i.rule] = (byRule[i.rule] || 0) + 1;

  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `EFD_${cnpj}_${period}.txt`);
  writeFileSync(outPath, content, "utf8");

  return {
    period,
    filesInDir: files.length,
    scopedDocs: scoped.documents.length,
    inPeriod: pf.inPeriod.length,
    records: lines.length,
    fieldCountOk: divergences.length === 0,
    fieldDivergences: divergences,
    issues: issues.length,
    issuesByRule: byRule,
    hash: (out.serialized?.contentHash || "").slice(0, 12),
  };
}

async function main() {
  const cnpj = digits(process.env.CNPJ || "03585024000490");
  const uf = process.env.UF || "SP";
  const codRec = process.env.COD_REC || "046-2";
  const baseDir = process.env.BASE_DIR || path.join(process.cwd(), "private-imports", "nfe");
  const outDir = process.env.OUT_DIR || path.join(process.cwd(), "private-exports", "efd-regression");

  if (!existsSync(baseDir)) {
    console.error("BASE_DIR não existe:", baseDir);
    process.exit(1);
  }
  const periods = readdirSync(baseDir)
    .filter((d) => /^\d{6}$/.test(d) && statSync(path.join(baseDir, d)).isDirectory())
    .sort();

  console.log(`Regressão EFD | CNPJ=${cnpj} UF=${uf} COD_REC=${codRec} | ${periods.length} períodos`);
  const results: PeriodResult[] = [];
  for (const p of periods) {
    const r = await runPeriod(path.join(baseDir, p), p, cnpj, uf, codRec, outDir);
    if (r) {
      results.push(r);
      const flag = r.inPeriod === 0 ? "vazio" : r.issues === 0 && r.fieldCountOk ? "OK" : "FALHA";
      console.log(
        `${p}  docs=${String(r.inPeriod).padStart(4)}  reg=${String(r.records).padStart(4)}  campos=${r.fieldCountOk ? "ok" : "DIVERGE"}  issues=${r.issues}  ${flag}  ${r.hash}`,
      );
      if (r.fieldDivergences.length) for (const d of r.fieldDivergences) console.log("   ! " + d);
      if (r.issues) console.log("   ! issues:", JSON.stringify(r.issuesByRule));
    }
  }

  const withData = results.filter((r) => r.inPeriod > 0);
  const clean = withData.filter((r) => r.issues === 0 && r.fieldCountOk);
  console.log(`\n=== RESUMO === períodos c/ dados: ${withData.length} | limpos (0 issues, campos ok): ${clean.length}`);

  // Relatório sanitizado (sem PII) para git.
  const md: string[] = [];
  md.push("# Regressão EFD ICMS/IPI — Cooperativa SP (dados reais)");
  md.push("");
  md.push(`Gerado por \`scripts/regression-efd.ts\` sobre a série histórica local (private-imports, gitignored).`);
  md.push(`Escopo: CNPJ \`${cnpj}\` · UF ${uf} · COD_REC ${codRec} · layout 020 · validador offline (leiaute 020, só períodos 2026+; pré-2026 usa COD_VER 019/018 e não é validado contra o 020).`);
  md.push("");
  md.push(`Períodos com dados: **${withData.length}** · limpos (0 issues + contagem de campos correta): **${clean.length}**.`);
  md.push("");
  md.push("| Período | NF-e no mês | Registros | Campos | Issues offline (2026+) | Regras de issue |");
  md.push("|---|---|---|---|---|---|");
  for (const r of results) {
    if (r.inPeriod === 0) {
      md.push(`| ${r.period} | 0 | — | — | — | (sem NF-e do CNPJ no mês) |`);
      continue;
    }
    const yearR = Number(r.period.slice(0, 4));
    const offlineLabel = yearR >= 2026 ? String(r.issues) : `n/a (COD_VER ${yearR >= 2025 ? "019" : yearR >= 2024 ? "018" : "017"})`;
    const rules = r.issues ? Object.entries(r.issuesByRule).map(([k, v]) => `${k}×${v}`).join(", ") : "—";
    md.push(`| ${r.period} | ${r.inPeriod} | ${r.records} | ${r.fieldCountOk ? "ok" : "DIVERGE"} | ${offlineLabel} | ${rules} |`);
  }
  md.push("");
  md.push("> TXTs reais gerados ficam em `private-exports/efd-regression/` (gitignored). Este resumo não contém PII.");
  const mdPath = path.join(process.cwd(), "docs", "pva", "REGRESSION_COOP_SP.md");
  mkdirSync(path.dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, md.join("\n") + "\n", "utf8");
  console.log("Resumo sanitizado:", mdPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
