import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/modules/ops/api-auth";
import {
  assertNoFalseProduction,
  buildCommercialSupportMatrix,
} from "@/modules/ops/commercial-matrix";
import { createRequestId } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  const auth = authenticateApiKey(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, requestId }, { status: auth.status });
  }
  const rows = buildCommercialSupportMatrix();
  return NextResponse.json({
    rows,
    noFalseProduction: assertNoFalseProduction(rows),
    requestId,
  });
}
