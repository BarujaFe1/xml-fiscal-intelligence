import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
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

async function main() {
  const inputDir =
    process.env.INPUT_DIR ||
    path.join(process.cwd(), "docs", "pva", "2026-06", "inputs");
  const cnpjArg = process.env.CNPJ || "";
  const start = process.env.START || "2026-06-01";
  const end = process.env.END || "2026-06-30";
  const outDir =
    process.env.OUT_DIR || path.join(process.cwd(), "docs", "pva", "2026-06", "output");
  const codRec = process.env.COD_REC || "04601";

  const files = readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith(".xml"));
  const documents: any[] = [];
  const items: any[] = [];
  const freq = new Map<string, number>();

  for (const f of files) {
    let xml = "";
    try {
      xml = readFileSync(path.join(inputDir, f), "utf8");
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = parseXmlDocument({ xml, fileName: f, batchId: "local", workspaceId: "ws" });
    } catch {
      continue;
    }
    if (!parsed?.document) continue;
    const d = parsed.document as any;
    documents.push(d);
    for (const it of parsed.items || []) items.push(it);
    const c = digits(d.emitterDoc) || digits(d.receiverDoc);
    if (c) freq.set(c, (freq.get(c) || 0) + 1);
  }

  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  const cnpj = (cnpjArg && digits(cnpjArg)) || top[0];
  console.log("CNPJ alvo:", cnpj, "| docs totais:", documents.length, "| top freq:", top[1]);

  const store: BatchStore = {
    batch: { workspaceId: "ws", id: "local" } as any,
    documents,
    items,
    fields: [],
    errors: [],
    exports: [],
  };
  const scoped = filterStoreByCnpj(store, cnpj);
  const pf = filterDocumentsByPeriod(scoped.documents, start, end);
  console.log("scoped:", scoped.documents.length, "| in-period:", pf.inPeriod.length);

  const sampleDoc = (pf.inPeriod[0] || scoped.documents[0]) as any;
  const isEmitter = digits(sampleDoc.emitterDoc) === digits(cnpj);
  const estab: any = {
    workspaceId: "ws",
    companyId: "co",
    establishmentId: "est",
    cnpj: isEmitter ? sampleDoc.emitterDoc || cnpj : sampleDoc.receiverDoc || cnpj,
    ie: isEmitter ? sampleDoc.emitterIe || "ISENTO" : sampleDoc.receiverIe || "ISENTO",
    uf: isEmitter ? sampleDoc.emitterUf || "SP" : sampleDoc.receiverUf || "SP",
    companyName: isEmitter ? sampleDoc.emitterName || "ESTAB" : sampleDoc.receiverName || "ESTAB",
    profile: "A",
    activityCode: "1",
    purpose: "0",
    periodStart: start,
    periodEnd: end,
    codMun: isEmitter ? sampleDoc.emitterCityCode || "3550308" : sampleDoc.receiverCityCode || "3550308",
    cep: isEmitter ? sampleDoc.emitterCep || "01310100" : sampleDoc.receiverCep || "01310100",
    address: isEmitter ? sampleDoc.emitterAddress || "RUA LOCAL" : sampleDoc.receiverAddress || "RUA LOCAL",
    addressNumber: "1",
    neighborhood: "CENTRO",
    layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    cnae: sampleDoc.cnae || "4623107",
    industrialClass: "02",
    icmsCodRec: codRec,
    accountantName: "Contador Demo",
    accountantCpf: "52998224725",
    accountantCrc: "SP123456/O",
    accountantEmail: "contador@exemplo.com.br",
  };

  const ctx = buildObligationContextFromBatch({
    establishment: estab,
    documents: pf.inPeriod,
    items: scoped.items,
  });
  const out: any = await runObligationPlugin(efdIcmsIpiPlugin as any, ctx as any);
  const content: string = out.serialized?.content || "";
  const lines = content.split(/\r?\n/).filter(Boolean);

  const dist: Record<string, Record<number, number>> = {};
  for (const l of lines) {
    const code = l.replace(/^\|/, "").split("|")[0];
    const n = l.split("|").length - 2;
    dist[code] = dist[code] || {};
    dist[code][n] = (dist[code][n] || 0) + 1;
  }
  console.log("=== field-count distribution (registro: {campos: n}) ===");
  for (const code of Object.keys(dist).sort()) {
    const def = getRecordDef(code);
    const exp = def ? def.fields.length : "?";
    const ok = def && Object.keys(dist[code]).every((k) => Number(k) === def!.fields.length);
    console.log(
      `${code.padEnd(8)} esperado=${exp} ${ok ? "OK" : "DIVERGE"} ${JSON.stringify(dist[code])}`,
    );
  }

  const issues = validateEfdOffline({ lines });
  const byRule: Record<string, number> = {};
  for (const i of issues) byRule[i.rule] = (byRule[i.rule] || 0) + 1;
  console.log("=== validacao offline: issues =", issues.length, "===");
  console.log(JSON.stringify(byRule, null, 0));
  if (issues.length) {
    for (const i of issues.slice(0, 25)) {
      console.log(
        `  [${i.severity}] ${i.rule} ${i.recordCode}${i.field ? "." + i.field : ""} L${i.line}: ${i.message}`,
      );
    }
  }

  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `EFD_${cnpj}_${start.replace(/-/g, "")}_${end.replace(/-/g, "")}.txt`,
  );
  writeFileSync(outPath, content, "utf8");
  console.log("WROTE:", outPath, "| linhas:", lines.length, "| hash:", out.serialized?.contentHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
