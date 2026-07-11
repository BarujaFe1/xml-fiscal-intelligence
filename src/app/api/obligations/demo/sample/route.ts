import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { parseXmlDocument } from "@/lib/parser";
import { DEMO_ESTABLISHMENT, DEMO_BATCH_ID } from "@/modules/obligations/demo-fixtures";
import type { BatchStore } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Returns a slim BatchStore + establishment for UI "Demo" fill buttons.
 * Does not invent fiscal facts — uses samples/anonymized/nfe-example.xml.
 */
export async function GET() {
  try {
    const xml = readFileSync(
      path.join(process.cwd(), "samples", "anonymized", "nfe-example.xml"),
      "utf8",
    );
    const parsed = parseXmlDocument({
      xml,
      fileName: "nfe-example.xml",
      batchId: DEMO_BATCH_ID,
      workspaceId: "ws_demo",
    });
    const now = new Date().toISOString();
    const store: BatchStore = {
      batch: {
        id: DEMO_BATCH_ID,
        workspaceId: "ws_demo",
        name: "Demo · NF-e exemplo",
        uploadedFileName: "nfe-example.xml",
        status: "completed",
        totalFiles: 1,
        totalXml: 1,
        validXml: 1,
        invalidXml: 0,
        nfeCount: parsed.document.documentType === "NFE" || parsed.document.documentType === "NFCE" ? 1 : 0,
        cteCount: parsed.document.documentType === "CTE" ? 1 : 0,
        nfseCount: parsed.document.documentType === "NFSE" ? 1 : 0,
        unknownCount: 0,
        duplicateCount: 0,
        totalValue: parsed.document.totalValue || 0,
        healthScore: 100,
        progress: 100,
        progressMessage: "demo sample",
        month: 3,
        year: 2026,
        cnpjLabel: DEMO_ESTABLISHMENT.cnpj,
        createdAt: now,
        updatedAt: now,
      },
      documents: [parsed.document],
      items: parsed.items,
      fields: [],
      errors: [],
      exports: [],
    };

    return NextResponse.json({
      establishment: DEMO_ESTABLISHMENT,
      store,
      sample: {
        fileName: "nfe-example.xml",
        documentType: parsed.document.documentType,
        number: parsed.document.number,
        totalValue: parsed.document.totalValue,
        itemCount: parsed.items.length,
      },
      note: "Dados de demonstração com NF-e anonimizada. Rascunho assistido — não é arquivo oficial.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao montar sample" },
      { status: 500 },
    );
  }
}
