import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServiceClient, hasServiceRole } from "@/lib/auth/supabase-service";
import { getFeatureFlags } from "@/lib/feature-flags";
import { ensureWorkspace } from "@/modules/repositories/supabase-batch-repository";
import { uuidFromLocalKey } from "@/lib/cloud/stable-uuid";

/** Upsert companies from local cadastro into cloud_companies. */
export async function POST(req: Request) {
  const flags = getFeatureFlags();
  if (!flags.cloudProcessing || !isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json(
      { error: "Cloud companies indisponível", code: "cloud_unavailable" },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as {
      workspaceId: string;
      companies: Array<{
        id?: string;
        name: string;
        cnpj?: string;
        kind?: string;
        ie?: string;
        uf?: string;
        codMun?: string;
        cep?: string;
        address?: string;
        addressNumber?: string;
        neighborhood?: string;
        source?: string;
      }>;
    };
    if (!body.workspaceId || !Array.isArray(body.companies)) {
      return NextResponse.json({ error: "workspaceId e companies[] obrigatórios" }, { status: 400 });
    }
    const workspaceId = await ensureWorkspace(body.workspaceId, "Workspace empresas");
    const supabase = createServiceClient();
    let saved = 0;
    for (const c of body.companies) {
      if (!c.cnpj && !c.name) continue;
      const id = uuidFromLocalKey("company", c.cnpj || c.id || c.name);
      const { error } = await supabase.from("cloud_companies").upsert(
        {
          id,
          workspace_id: workspaceId,
          local_key: c.id || c.cnpj || null,
          name: c.name,
          cnpj: c.cnpj || null,
          kind: c.kind || null,
          ie: c.ie || null,
          uf: c.uf || null,
          cod_mun: c.codMun || null,
          cep: c.cep || null,
          address: c.address || null,
          address_number: c.addressNumber || null,
          neighborhood: c.neighborhood || null,
          source: c.source || "form",
          payload_json: c,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (!error) saved += 1;
    }
    return NextResponse.json({ ok: true, saved, workspaceId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "companies sync failed" },
      { status: 500 },
    );
  }
}
