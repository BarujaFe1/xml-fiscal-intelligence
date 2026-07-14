import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/modules/ops/api-auth";
import {
  OBLIGATION_IDS,
  OBLIGATION_LABELS,
  OBLIGATION_SUPPORT_PROFILES,
} from "@/modules/obligations";
import { createRequestId } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = createRequestId();
  const auth = authenticateApiKey(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, requestId }, { status: auth.status });
  }
  const items = OBLIGATION_IDS.map((id) => ({
    id,
    label: OBLIGATION_LABELS[id],
    maturity: OBLIGATION_SUPPORT_PROFILES[id].maturity,
    bannerNonProduction:
      OBLIGATION_SUPPORT_PROFILES[id].maturity !== "validated_scope" &&
      OBLIGATION_SUPPORT_PROFILES[id].maturity !== "production",
  }));
  return NextResponse.json({ items, requestId });
}
