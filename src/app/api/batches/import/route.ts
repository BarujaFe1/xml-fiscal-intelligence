import { NextRequest, NextResponse } from "next/server";
import { getBatchStore, saveBatchStore } from "@/lib/store/fs-store";
import type { Batch, BatchStore, DocumentItem, DocumentSummary, ParseError } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportBody =
  | {
      action: "create";
      batch: Batch;
    }
  | {
      action: "append";
      batchId: string;
      documents?: DocumentSummary[];
      items?: DocumentItem[];
      errors?: ParseError[];
    }
  | {
      action: "finalize";
      batchId: string;
      batch: Batch;
      errors?: ParseError[];
    };

/**
 * Chunked import for client-side ZIP processing.
 * Avoids Vercel ~4.5MB request body limit on raw ZIP upload.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImportBody;

    if (body.action === "create") {
      const store: BatchStore = {
        batch: { ...body.batch, status: "processing", progress: 5 },
        documents: [],
        items: [],
        fields: [],
        errors: [],
        exports: [],
      };
      await saveBatchStore(store);
      return NextResponse.json({ batch: store.batch });
    }

    if (body.action === "append") {
      const store = await getBatchStore(body.batchId);
      if (!store) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });

      if (body.documents?.length) store.documents.push(...body.documents);
      if (body.items?.length) store.items.push(...body.items);
      if (body.errors?.length) store.errors.push(...body.errors);

      store.batch.progress = Math.min(95, 10 + Math.round((store.documents.length / Math.max(store.batch.totalXml || 1, 1)) * 80));
      store.batch.progressMessage = `Recebendo documentos… ${store.documents.length}`;
      store.batch.updatedAt = new Date().toISOString();
      await saveBatchStore(store);
      return NextResponse.json({
        ok: true,
        documentCount: store.documents.length,
        itemCount: store.items.length,
      });
    }

    if (body.action === "finalize") {
      const store = await getBatchStore(body.batchId);
      if (!store) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });

      store.batch = {
        ...body.batch,
        id: body.batchId,
        status: body.batch.status || "completed",
        progress: 100,
        progressMessage: "Processamento concluído",
        updatedAt: new Date().toISOString(),
      };
      if (body.errors?.length) store.errors = body.errors;
      await saveBatchStore(store);
      return NextResponse.json({ batch: store.batch });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
