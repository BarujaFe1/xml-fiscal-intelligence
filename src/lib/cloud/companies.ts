/**
 * Cloud cadastro sync (client side). Mirrors local IndexedDB cadastro into
 * cloud_companies via /api/companies/sync. Cloud is source of truth when the
 * API is available; otherwise the app stays local-first (IndexedDB).
 *
 * Client gating uses isSupabaseConfigured() (NEXT_PUBLIC_* are exposed to the
 * browser). The server route additionally requires FEATURE_CLOUD_PROCESSING=1
 * and the service-role key; if absent it returns 503 and we fall back silently.
 */

import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  listCompanies,
  upsertCompanyByCnpj,
  type LocalCompany,
} from "@/lib/store/local-cadastro";

export const CLOUD_WORKSPACE_ID = "ws_local_demo";

export function isCloudCompaniesEnabled(): boolean {
  return isSupabaseConfigured();
}

async function getJson(url: string): Promise<{ companies?: LocalCompany[] } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as { companies?: LocalCompany[] };
  } catch {
    return null;
  }
}

async function postJson(url: string, body: unknown): Promise<{ saved?: number } | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as { saved?: number };
  } catch {
    return null;
  }
}

export async function loadCloudCompanies(): Promise<LocalCompany[]> {
  const json = await getJson(
    `/api/companies/sync?workspaceId=${encodeURIComponent(CLOUD_WORKSPACE_ID)}`,
  );
  return json?.companies ?? [];
}

export async function pushCompaniesToCloud(companies: LocalCompany[]): Promise<number> {
  const json = await postJson(`/api/companies/sync`, {
    workspaceId: CLOUD_WORKSPACE_ID,
    companies,
  });
  return json?.saved ?? 0;
}

/** Pull cloud -> local cache (upsert by CNPJ; cloud non-empty values win). */
export async function syncCloudToLocal(): Promise<void> {
  const cloud = await loadCloudCompanies();
  for (const c of cloud) {
    if (!c.cnpj && !c.name) continue;
    await upsertCompanyByCnpj({ ...c, name: c.name, cnpj: c.cnpj || "" });
  }
}

/** Two-way sync used by the companies page: push local -> cloud, then pull. */
export async function syncCompaniesWithCloud(): Promise<void> {
  if (!isCloudCompaniesEnabled()) return;
  const all = await listCompanies();
  await pushCompaniesToCloud(all);
  await syncCloudToLocal();
}
