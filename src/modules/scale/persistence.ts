/**
 * Inventário de persistência — DR / backup.
 */

import type { PersistenceInventoryItem } from "@/modules/scale/types";

export const PERSISTENCE_INVENTORY: PersistenceInventoryItem[] = [
  {
    id: "idb_batches",
    layer: "indexeddb_browser",
    description: "Lotes XML / stores locais (xfi_*_v1)",
    containsFiscalPayload: true,
    backupOwner: "customer",
    notes: ["Volátil por browser/dispositivo", "Migrar via /app/migrate"],
  },
  {
    id: "idb_ops_governance",
    layer: "indexeddb_browser",
    description: "Ops, continuous-ops, governance, enterprise, homologation IDB",
    containsFiscalPayload: false,
    backupOwner: "customer",
    notes: ["Metadados + hashes; evidências binárias RFB fora"],
  },
  {
    id: "supabase_workspaces",
    layer: "supabase_postgres",
    description: "Workspaces, RLS, espelhos migrations",
    containsFiscalPayload: false,
    backupOwner: "shared",
    notes: ["Depende de projeto Supabase linkado", "PITR conforme plano Supabase"],
  },
  {
    id: "vercel_blob",
    layer: "vercel_blob",
    description: "Snapshots cloud / evidências metadata refs",
    containsFiscalPayload: true,
    backupOwner: "platform",
    notes: ["Só com FEATURE_CLOUD_PROCESSING / migrate"],
  },
  {
    id: "process_telemetry",
    layer: "process_memory",
    description: "Telemetry buffer + API quota Map",
    containsFiscalPayload: false,
    backupOwner: "platform",
    notes: ["Ephemeral serverless — não é SoR"],
  },
  {
    id: "repo_fixtures",
    layer: "local_filesystem",
    description: "Fixtures/golden sintéticos no git",
    containsFiscalPayload: false,
    backupOwner: "platform",
    notes: ["Zero dados reais de cliente"],
  },
];

export function persistenceInventoryMarkdown(
  items: PersistenceInventoryItem[] = PERSISTENCE_INVENTORY,
): string {
  const lines = [
    "# Inventário de persistência",
    "",
    "| id | layer | fiscal | owner |",
    "|----|-------|--------|-------|",
  ];
  for (const i of items) {
    lines.push(
      `| ${i.id} | ${i.layer} | ${i.containsFiscalPayload ? "yes" : "no"} | ${i.backupOwner} |`,
    );
  }
  return lines.join("\n");
}
