import { NextRequest, NextResponse } from "next/server";
import { LocalPrivateStorage } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";

/**
 * Private local download — never use for Supabase/cloud objects.
 * Query: ?w=workspaceId&k=objectKey
 */
export async function GET(req: NextRequest) {
  const w = req.nextUrl.searchParams.get("w") || "";
  const k = req.nextUrl.searchParams.get("k") || "";
  if (!w || !k || w.includes("..") || k.includes("..")) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  try {
    const storage = new LocalPrivateStorage();
    const body = await storage.getObject({ workspaceId: w, key: k });
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${k.split("/").pop() || "download"}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
