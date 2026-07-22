import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createServiceClient, hasServiceRole } from "@/lib/auth/supabase-service";
import { getFeatureFlags } from "@/lib/feature-flags";
import { ensureWorkspace } from "@/modules/repositories/supabase-batch-repository";
import { uuidFromLocalKey } from "@/lib/cloud/stable-uuid";
import type { LocalCompany } from "@/lib/store/local-cadastro";
import { requireApiSession } from "@/lib/auth/api-guard";
import { assertWorkspaceMembership } from "@/lib/auth/workspace-access";

function cloudUnavailable() {
  return NextResponse.json(
    { error: "Cloud companies indisponível", code: "cloud_unavailable" },
    { status: 503 },
  );
}

/** Persist local cadastro into cloud_companies (full payload + indexed fiscal columns). */
export async function POST(req: Request) {
  const auth = await requireApiSession({ requireCloudAuth: true });
  if (!auth.ok) return auth.response;

  const flags = getFeatureFlags();
  if (!flags.cloudProcessing || !isSupabaseConfigured() || !hasServiceRole()) {
    return cloudUnavailable();
  }

  try {
    const body = (await req.json()) as { workspaceId: string; companies: LocalCompany[] };
    if (!body.workspaceId || !Array.isArray(body.companies)) {
      return NextResponse.json({ error: "workspaceId e companies[] obrigatórios" }, { status: 400 });
    }
    const workspaceId = await ensureWorkspace(body.workspaceId, "Workspace empresas", {
      ownerUserId: auth.userId,
    });
    const membership = await assertWorkspaceMembership(auth.userId, workspaceId, [
      "owner",
      "admin",
      "accountant",
      "operator",
    ]);
    if (!membership.ok) return membership.response;
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
          activity_code: c.activityCode || null,
          profile: c.profile || null,
          purpose: c.purpose || null,
          industrial_class: c.industrialClass || null,
          prior_credit_balance: c.priorCreditBalance || null,
          cnae: c.cnae || null,
          cnae_description: c.cnaeDescription || null,
          accountant_name: c.accountantName || null,
          accountant_cpf: c.accountantCpf || null,
          accountant_crc: c.accountantCrc || null,
          accountant_email: c.accountantEmail || null,
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

/** Read cloud cadastro for a workspace (reconstructs LocalCompany from payload_json). */
export async function GET(req: Request) {
  const flags = getFeatureFlags();
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!flags.cloudProcessing || !isSupabaseConfigured() || !hasServiceRole()) {
    return cloudUnavailable();
  }
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId obrigatório" }, { status: 400 });
  }
  try {
    const ws = await ensureWorkspace(workspaceId, "Workspace empresas");
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("cloud_companies")
      .select("*")
      .eq("workspace_id", ws);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const companies = (data || []).map((row) => row.payload_json as LocalCompany);
    return NextResponse.json({ ok: true, companies });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "companies load failed" },
      { status: 500 },
    );
  }
}
