import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import {
  buildObligationContextFromBatch,
  obligationPlugins,
  runObligationPlugin,
  type ObligationId,
  EFD_ICMS_IPI_LAYOUT_2026,
} from "@/modules/obligations";

export const dynamic = "force-dynamic";

/**
 * Demo endpoint: runs all active obligation plugins against anonymized NF-e sample.
 * Honest: assisted drafts only — not PVA-official.
 */
export async function POST() {
  try {
    const xml = readFileSync(
      path.join(process.cwd(), "samples", "anonymized", "nfe-example.xml"),
      "utf8",
    );
    const parsed = parseXmlDocument({
      xml,
      fileName: "nfe-example.xml",
      batchId: "demo_batch",
      workspaceId: "ws_demo",
    });

    const establishment = {
      workspaceId: "ws_demo",
      companyId: "co_demo",
      establishmentId: "est_demo",
      cnpj: "11222333000181",
      ie: "123456789012",
      uf: "SP",
      companyName: "EMPRESA DEMO EMITENTE LTDA",
      profile: "A" as const,
      activityCode: "0",
      purpose: "0" as const,
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      accountantName: "Contador Demo",
      accountantCpf: "39053344705",
      layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
    };

    const context = buildObligationContextFromBatch({
      establishment,
      documents: [parsed.document],
      items: parsed.items,
    });

    const results: Record<string, unknown> = {};
    for (const id of Object.keys(obligationPlugins) as ObligationId[]) {
      const plugin = obligationPlugins[id];
      const ctx = {
        ...context,
        layoutVersion: (await plugin.resolveVersion(context)).layoutVersion,
      };
      const out = await runObligationPlugin(plugin, ctx);
      results[id] = {
        canGenerate: out.readiness.canGenerate,
        readiness: out.readiness.items,
        ok: out.validation?.ok ?? false,
        recordCount: out.serialized?.recordCount ?? 0,
        contentHash: out.serialized?.contentHash ?? null,
        contentPreview: out.serialized?.content.slice(0, 2500) ?? null,
        content: out.serialized?.content ?? null,
        warnings: out.build?.warnings ?? [],
        disclaimer: out.manifest?.disclaimer ?? null,
        issues: out.validation?.issues ?? [],
      };
    }

    return NextResponse.json({
      ok: true,
      sample: {
        fileName: "nfe-example.xml",
        documentType: parsed.document.documentType,
        accessKey: parsed.document.accessKey,
        number: parsed.document.number,
        totalValue: parsed.document.totalValue,
        itemCount: parsed.items.length,
      },
      results,
      note: "Demonstração com XML anonimizado. Arquivos são rascunhos assistidos — conferir no PVA/portal oficial.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na demonstração" },
      { status: 500 },
    );
  }
}
