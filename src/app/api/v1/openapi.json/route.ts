import { NextResponse } from "next/server";
import { OPS_OPENAPI_V1 } from "@/modules/ops/openapi";

export const dynamic = "force-dynamic";

/** OpenAPI public (sem API key) para descoberta local. */
export async function GET() {
  return NextResponse.json(OPS_OPENAPI_V1);
}
