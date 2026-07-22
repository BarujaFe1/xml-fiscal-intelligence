import { NextRequest, NextResponse } from "next/server";
import { searchAllStores, searchBatchStore } from "@/lib/search";
import { getBatchStore, listBatchStores } from "@/lib/store/fs-store";
import { requireApiSession } from "@/lib/auth/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams.get("q") || "";
  const batchId = req.nextUrl.searchParams.get("batchId");
  const documentType = req.nextUrl.searchParams.get("type") || undefined;

  if (!q.trim()) return NextResponse.json({ results: [] });

  if (batchId) {
    const store = await getBatchStore(auth.userId, batchId);
    if (!store) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
    return NextResponse.json({
      results: searchBatchStore(store, q, { documentType, limit: 80 }),
    });
  }

  const stores = await listBatchStores(auth.userId);
  return NextResponse.json({
    results: searchAllStores(stores, q, 80),
  });
}
