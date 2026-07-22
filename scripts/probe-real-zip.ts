/**
 * End-to-end functional probe using real SIEG-style ZIP from Downloads.
 * Does not invent fiscal data — reports what the pipeline produces.
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/probe-real-zip.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { processZipBatchInMemory } from "../src/lib/store/process-memory";
import { buildBatchWorkbook, buildDocumentsCsv, buildItemsCsv, buildBatchJsonEnvelope, buildHtmlReport } from "../src/lib/export/excel";
import {
  buildObligationContextFromBatch,
  obligationPlugins,
  runObligationPlugin,
  type ObligationId,
  EFD_ICMS_IPI_LAYOUT_2026,
} from "../src/modules/obligations";
import { searchBatchStore } from "../src/lib/search";
import { buildDocumentRelationships } from "../src/modules/relationships";
import { reprocessAnalysis } from "../src/lib/analysis/reprocess";
import { observeRtcTags } from "../src/lib/parser/rtc-observe";
import { formatCnpj } from "../src/lib/fiscal/cnpj";
import {
  buildParties,
  compareBatches,
  emptyDocFilters,
  filterDocuments,
  filterItems,
} from "../src/lib/analytics";
import { comparePvaRuns, type PvaValidationRecord } from "../src/modules/obligations/efd-icms-ipi/pva/workflow";
import { reconcileBatchDocuments } from "../src/modules/reconciliation";

const ZIP =
  process.env.PROBE_ZIP ||
  path.join(process.env.USERPROFILE || "", "Downloads", "202606 NFe.zip");

type Finding = { area: string; severity: "ok" | "warn" | "error"; message: string };

async function main() {
  const findings: Finding[] = [];
  const outDir = path.join(process.cwd(), "private-exports", "probe-202606");
  mkdirSync(outDir, { recursive: true });

  console.log("ZIP:", ZIP);
  const buffer = readFileSync(ZIP);
  console.log("bytes:", buffer.length);

  const t0 = performance.now();
  const { store } = await processZipBatchInMemory({
    buffer,
    fileName: "202606 NFe.zip",
    name: "202606-NFe-probe",
    cnpjLabel: undefined,
    month: 6,
    year: 2026,
    keepRawJson: false,
    keepFields: false,
    incremental: false,
    onProgress: (p, m) => {
      if (p % 20 === 0 || p >= 95) console.log(`  import ${p}% ${m}`);
    },
  });
  const importMs = performance.now() - t0;
  console.log(
    `import ${importMs.toFixed(0)}ms docs=${store.documents.length} items=${store.items.length} findings=${store.findings?.length || 0}`,
  );

  const b = store.batch;
  findings.push({
    area: "import",
    severity: b.validXml > 0 ? "ok" : "error",
    message: `xml=${b.totalXml} valid=${b.validXml} invalid=${b.invalidXml} nfe=${b.nfeCount} cte=${b.cteCount} nfse=${b.nfseCount} unknown=${b.unknownCount} dup=${b.duplicateCount}`,
  });
  findings.push({
    area: "quality",
    severity: b.healthScore == null && b.validXml === 0 ? "warn" : "ok",
    message: `healthScore=${b.healthScore} eval=${b.quality?.evaluationStatus} formula=${b.quality?.formulaVersion}`,
  });

  // Relationships
  const rels =
    store.relationships ||
    buildDocumentRelationships({
      workspaceId: b.workspaceId,
      documents: store.documents,
      items: store.items,
    });
  findings.push({
    area: "relationships",
    severity: "ok",
    message: `count=${rels.length}`,
  });

  // Search
  const needle = store.documents[0]?.emitterName?.slice(0, 6) || "a";
  const searchHits = searchBatchStore(store, needle, { limit: 20 });
  findings.push({
    area: "search",
    severity: "ok",
    message: `query="${needle}" hits=${searchHits.length}`,
  });

  // CNPJ format on sample docs
  let cnpjOk = 0;
  let cnpjBad = 0;
  for (const d of store.documents.slice(0, 50)) {
    const f = formatCnpj(d.emitterDoc);
    if (f && f !== "—") cnpjOk += 1;
    else if (d.emitterDoc) cnpjBad += 1;
  }
  findings.push({
    area: "cnpj",
    severity: cnpjBad > cnpjOk ? "warn" : "ok",
    message: `sample50 format ok=${cnpjOk} unformatted=${cnpjBad}`,
  });

  // RTC observe sample
  let rtc = 0;
  for (const d of store.documents.slice(0, 100)) {
    const obs = observeRtcTags({
      flattenedKeys: Object.keys(d.flattenedJson || {}),
    });
    if (obs.hasRtcHints) rtc += 1;
  }
  findings.push({ area: "rtc", severity: "ok", message: `hints in first100=${rtc}` });

  // Reprocess
  const re = reprocessAnalysis(store, "probe reprocess");
  findings.push({
    area: "reprocess",
    severity: (re.analysisGenerations?.length || 0) > 0 ? "ok" : "error",
    message: `generations=${re.analysisGenerations?.length || 0}`,
  });

  // Exports
  try {
    const xlsx = await buildBatchWorkbook(store);
    writeFileSync(path.join(outDir, "lote.xlsx"), xlsx);
    const csv = buildDocumentsCsv(store);
    writeFileSync(path.join(outDir, "documentos.csv"), csv, "utf8");
    const itemsCsv = buildItemsCsv(store);
    writeFileSync(path.join(outDir, "itens.csv"), itemsCsv, "utf8");
    const envelope = buildBatchJsonEnvelope(store);
    writeFileSync(path.join(outDir, "envelope.json"), JSON.stringify(envelope).slice(0, 500000), "utf8");
    const html = buildHtmlReport(store);
    writeFileSync(path.join(outDir, "relatorio.html"), html, "utf8");
    findings.push({
      area: "exports",
      severity: xlsx.length > 1000 && csv.includes("id") ? "ok" : "warn",
      message: `xlsx=${xlsx.length}B csvDocs=${csv.length} csvItems=${itemsCsv.length} html=${html.length} envelopeKeys=${Object.keys(envelope).join(",")}`,
    });
  } catch (e) {
    findings.push({
      area: "exports",
      severity: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  // Obligations (all plugins) — use subset if huge for speed? Full docs for honesty.
  const establishment = {
    workspaceId: b.workspaceId,
    companyId: "co_probe",
    establishmentId: "est_probe",
    cnpj: store.documents[0]?.emitterDoc?.replace(/\D/g, "").slice(0, 14) || "11222333000181",
    ie: "123456789012",
    uf: store.documents[0]?.emitterUf || "SP",
    companyName: store.documents[0]?.emitterName || "PROBE EMPRESA",
    profile: "A" as const,
    activityCode: "0",
    purpose: "0" as const,
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    accountantName: "Contador Probe",
    accountantCpf: "39053344705",
    layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
  };

  // Cap documents for obligations if enormous (memory) — still real data
  const maxDocs = Math.min(store.documents.length, 400);
  const context = buildObligationContextFromBatch({
    establishment,
    documents: store.documents.slice(0, maxDocs),
    items: store.items.filter((i) =>
      store.documents.slice(0, maxDocs).some((d) => d.id === i.documentId),
    ),
  });
  if (maxDocs < store.documents.length) {
    findings.push({
      area: "obligations",
      severity: "warn",
      message: `using first ${maxDocs}/${store.documents.length} docs for obligation generation (memory cap)`,
    });
  }

  for (const id of Object.keys(obligationPlugins) as ObligationId[]) {
    try {
      const plugin = obligationPlugins[id];
      const layoutVersion = (await plugin.resolveVersion(context)).layoutVersion;
      const out = await runObligationPlugin(plugin, { ...context, layoutVersion });
      const sev =
        !out.readiness.canGenerate
          ? "error"
          : out.validation && !out.validation.ok
            ? "warn"
            : "ok";
      findings.push({
        area: `obligation:${id}`,
        severity: sev,
        message: `can=${out.readiness.canGenerate} ok=${out.validation?.ok} records=${out.serialized?.recordCount} hash=${out.serialized?.contentHash?.slice(0, 10)}`,
      });
      if (out.serialized) {
        const ext = id === "reinf" ? "json" : "txt";
        writeFileSync(path.join(outDir, `${id}.${ext}`), out.serialized.content, "utf8");
      }
      if (out.build?.warnings?.length) {
        findings.push({
          area: `obligation:${id}:warnings`,
          severity: "warn",
          message: out.build.warnings.slice(0, 3).join(" | "),
        });
      }
    } catch (e) {
      findings.push({
        area: `obligation:${id}`,
        severity: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Audit findings summary
  const bySev = new Map<string, number>();
  for (const f of store.findings || []) {
    bySev.set(f.severity || "?", (bySev.get(f.severity || "?") || 0) + 1);
  }
  findings.push({
    area: "audit",
    severity: "ok",
    message: `findings=${store.findings?.length || 0} bySeverity=${JSON.stringify(Object.fromEntries(bySev))}`,
  });

  // Parse errors
  findings.push({
    area: "parse_errors",
    severity: store.errors.length > 0 ? "warn" : "ok",
    message: `count=${store.errors.length} sample=${store.errors
      .slice(0, 3)
      .map((e) => e.errorType)
      .join(",")}`,
  });

  // Parties / filters / compare (UI analytics surfaces)
  try {
    const parties = buildParties(store);
    const emitters = parties.filter((p) => p.role === "emitter" || p.role === "both");
    const receivers = parties.filter((p) => p.role === "receiver" || p.role === "both");
    findings.push({
      area: "parties",
      severity: parties.length > 0 ? "ok" : "warn",
      message: `rows=${parties.length} emitters=${emitters.length} receivers=${receivers.length}`,
    });

    const uf = store.documents.find((d) => d.emitterUf)?.emitterUf || "";
    const filters = { ...emptyDocFilters(), type: "NFE", uf };
    const filteredDocs = filterDocuments(store, filters);
    const filteredItems = filterItems(store, filteredDocs, filters);
    findings.push({
      area: "filters",
      severity: filteredDocs.length > 0 ? "ok" : "warn",
      message: `uf=${uf || "n/a"} docs=${filteredDocs.length}/${store.documents.length} items=${filteredItems.length}`,
    });

    const half = Math.max(1, Math.floor(store.documents.length / 2));
    const docsA = store.documents.slice(0, half);
    const docsB = store.documents.slice(half);
    const storeA = {
      ...store,
      documents: docsA,
      items: store.items.filter((i) => docsA.some((d) => d.id === i.documentId)),
      batch: {
        ...store.batch,
        id: `${store.batch.id}_a`,
        name: "half-a",
        totalXml: docsA.length,
        validXml: docsA.length,
        nfeCount: docsA.filter((d) => d.documentType === "NFE").length,
        totalValue: docsA.reduce((s, d) => s + (d.totalValue || 0), 0),
      },
    };
    const storeB = {
      ...store,
      documents: docsB,
      items: store.items.filter((i) => docsB.some((d) => d.id === i.documentId)),
      batch: {
        ...store.batch,
        id: `${store.batch.id}_b`,
        name: "half-b",
        totalXml: docsB.length,
        validXml: docsB.length,
        nfeCount: docsB.filter((d) => d.documentType === "NFE").length,
        totalValue: docsB.reduce((s, d) => s + (d.totalValue || 0), 0),
      },
    };
    const cmp = compareBatches(storeA, storeB);
    findings.push({
      area: "compare",
      severity: "ok",
      message: `deltaDocs=${cmp.deltaDocs} deltaValue=${Math.round(cmp.deltaValue)} newEmitters=${cmp.newEmitters.length} gone=${cmp.goneEmitters.length} cfopDelta=${cmp.cfopDelta.length}`,
    });

    const recon = reconcileBatchDocuments({
      documents: store.documents,
      linkedNfeKeysFromCte: new Set(),
    });
    findings.push({
      area: "reconciliation",
      severity: "ok",
      message: `issues=${recon.length} kinds=${[...new Set(recon.map((r) => r.kind))].join(",") || "none"}`,
    });
  } catch (e) {
    findings.push({
      area: "analytics",
      severity: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  // PVA compare (synthetic runs from audit findings — exercises diff, not official PVA file)
  try {
    const issues = (store.findings || []).slice(0, 10).map((f, i) => ({
      code: f.code || `F${i}`,
      severity: (f.severity as "info" | "warning" | "error") || "info",
      message: f.description || f.title || "issue",
    }));
    const base = {
      generationId: "gen_probe",
      pvaVersion: "probe",
      resultStatus: "warnings" as const,
      disclaimer: "probe",
      validationLevel: 3 as const,
    };
    const left: PvaValidationRecord = {
      ...base,
      id: "pva_left",
      importedAt: new Date().toISOString(),
      issues: issues.slice(0, 5),
    };
    const right: PvaValidationRecord = {
      ...base,
      id: "pva_right",
      importedAt: new Date().toISOString(),
      issues: issues.slice(2, 8),
    };
    const pva = comparePvaRuns(left, right);
    findings.push({
      area: "pva_compare",
      severity: "ok",
      message: `added=${pva.added.length} removed=${pva.removed.length} unchanged=${pva.unchangedCount}`,
    });
  } catch (e) {
    findings.push({
      area: "pva_compare",
      severity: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  // Persist summary store meta (without huge payloads)
  const summary = {
    zip: ZIP,
    importMs: Math.round(importMs),
    batch: {
      id: b.id,
      totalXml: b.totalXml,
      validXml: b.validXml,
      invalidXml: b.invalidXml,
      nfeCount: b.nfeCount,
      cteCount: b.cteCount,
      nfseCount: b.nfseCount,
      unknownCount: b.unknownCount,
      duplicateCount: b.duplicateCount,
      totalValue: b.totalValue,
      healthScore: b.healthScore,
      evaluationStatus: b.quality?.evaluationStatus,
    },
    documents: store.documents.length,
    items: store.items.length,
    findings: store.findings?.length || 0,
    probeFindings: findings,
  };
  writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

  console.log("\n=== PROBE FINDINGS ===");
  for (const f of findings) {
    console.log(`[${f.severity.toUpperCase()}] ${f.area}: ${f.message}`);
  }
  const errors = findings.filter((f) => f.severity === "error");
  console.log(`\nerrors=${errors.length} warns=${findings.filter((f) => f.severity === "warn").length}`);
  console.log("wrote", outDir);
  if (errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
