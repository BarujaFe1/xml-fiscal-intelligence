import { NextRequest, NextResponse } from "next/server";
import { getBatchStore, readRawXml } from "@/lib/store/fs-store";
import { requireApiSession } from "@/lib/auth/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; documentId: string }> },
) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;
  const { id, documentId } = await ctx.params;
  const store = await getBatchStore(auth.userId, id);
  if (!store) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format") || "json";
  if (format === "xml" && doc.rawXmlPath) {
    try {
      const xml = await readRawXml(doc.rawXmlPath);
      return new NextResponse(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${doc.fileName}"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "XML não disponível" }, { status: 404 });
    }
  }

  const items = store.items.filter((i) => i.documentId === documentId);
  const fields = store.fields.filter((f) => f.documentId === documentId);
  return NextResponse.json({ document: doc, items, fields });
}
