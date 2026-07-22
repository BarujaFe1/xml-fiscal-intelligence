import { NextRequest, NextResponse } from "next/server";
import { listBatchStores } from "@/lib/store/fs-store";
import { processZipBatch } from "@/lib/store/process";
import { requireApiSession } from "@/lib/auth/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 50);

export async function GET() {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;
  const stores = await listBatchStores(auth.userId);
  return NextResponse.json({
    batches: stores.map((s) => s.batch),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (!auth.ok) return auth.response;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo ZIP obrigatório" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Apenas arquivos .zip são aceitos" }, { status: 400 });
    }
    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Arquivo excede o limite de ${MAX_UPLOAD_MB}MB` },
        { status: 400 },
      );
    }

    const name = String(form.get("name") || "") || undefined;
    const cnpjLabel = String(form.get("cnpjLabel") || "") || undefined;
    const month = form.get("month") ? Number(form.get("month")) : undefined;
    const year = form.get("year") ? Number(form.get("year")) : undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const store = await processZipBatch({
      buffer,
      fileName: file.name,
      name,
      cnpjLabel,
      month,
      year,
      ownerKey: auth.userId,
    });

    return NextResponse.json({ batch: store.batch });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha no upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
