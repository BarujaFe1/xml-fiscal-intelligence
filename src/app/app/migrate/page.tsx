"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import {
  formatBytes,
  inventoryLocalBatches,
  migrateLocalBatches,
  removeLocalAfterSync,
  type LocalBatchInventoryItem,
  type MigrationBatchResult,
} from "@/lib/sync/migrate-local";

export default function MigratePage() {
  const [items, setItems] = useState<LocalBatchInventoryItem[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [workspaceId, setWorkspaceId] = useState("");
  const [companyLabel, setCompanyLabel] = useState("");
  const [establishmentLabel, setEstablishmentLabel] = useState("");
  const [keepLocal, setKeepLocal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<MigrationBatchResult[]>([]);
  const [phase, setPhase] = useState<string>("discovered");

  const refresh = useCallback(async () => {
    const inv = await inventoryLocalBatches();
    setItems(inv.items);
    setTotalBytes(inv.totalApproxBytes);
    setSelected(new Set(inv.items.filter((i) => i.syncStatus !== "synced").map((i) => i.id)));
    setPhase(inv.items.length ? "prepared" : "discovered");
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        const stored =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("xfi:workspace-id")
            : null;
        const id = stored || crypto.randomUUID();
        if (!stored && typeof localStorage !== "undefined") {
          localStorage.setItem("xfi:workspace-id", id);
        }
        if (!cancelled) setWorkspaceId(id);
        const inv = await inventoryLocalBatches();
        if (cancelled) return;
        setItems(inv.items);
        setTotalBytes(inv.totalApproxBytes);
        setSelected(new Set(inv.items.filter((i) => i.syncStatus !== "synced").map((i) => i.id)));
        setPhase(inv.items.length ? "prepared" : "discovered");
      })();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runMigrate() {
    if (!selected.size) {
      toast.error("Selecione ao menos um lote");
      return;
    }
    setBusy(true);
    setResults([]);
    setPhase("uploading");
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("xfi:workspace-id", workspaceId);
      }
      const { results: r, cloudConfigured } = await migrateLocalBatches({
        batchIds: [...selected],
        workspaceId: workspaceId || crypto.randomUUID(),
        companyLabel: companyLabel || undefined,
        establishmentLabel: establishmentLabel || undefined,
        keepLocalCopy: keepLocal,
      });
      setResults(r);
      setPhase(r.every((x) => x.ok) ? "synchronized" : cloudConfigured ? "conflict" : "failed");
      if (!cloudConfigured) {
        toast.message("Nuvem indisponível — lotes permanecem locais");
      } else if (r.every((x) => x.ok)) {
        toast.success("Migração concluída (metadados + docs)");
      } else {
        toast.error("Migração parcial — veja o relatório");
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeSynced(id: string) {
    try {
      await removeLocalAfterSync(id);
      toast.success("Cópia local removida");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Migrar lotes locais → nuvem
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Assistente idempotente por lote (UUID estável a partir do id local). Fase:{" "}
          <span className="font-mono text-sky-300">{phase}</span>. XML bruto permanece no navegador
          até cloud storage estar habilitado.
        </p>
      </div>

      <LocalPersistenceBanner />

      <Card>
        <CardHeader>
          <CardTitle>Inventário IndexedDB</CardTitle>
          <CardDescription>
            {items.length} lote(s) · ~{formatBytes(totalBytes)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!items.length && (
            <p className="text-sm text-slate-400">
              Nenhum lote local.{" "}
              <Link href="/app/upload" className="text-sky-300">
                Importar ZIP
              </Link>
            </p>
          )}
          {items.map((item) => (
            <label
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-100">{item.name}</div>
                <div className="text-xs text-slate-500">
                  {item.documents} docs · {item.items} itens · {formatBytes(item.approxBytes)}
                </div>
              </div>
              <Badge
                tone={
                  item.syncStatus === "synced"
                    ? "success"
                    : item.syncStatus === "error"
                      ? "error"
                      : "warning"
                }
              >
                {item.syncStatus}
              </Badge>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destino</CardTitle>
          <CardDescription>Contexto SaaS — validado no servidor quando auth estiver ativo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>Workspace ID</Label>
            <Input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Empresa (rótulo)</Label>
            <Input value={companyLabel} onChange={(e) => setCompanyLabel(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Estabelecimento (rótulo)</Label>
            <Input
              value={establishmentLabel}
              onChange={(e) => setEstablishmentLabel(e.target.value)}
            />
          </div>
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={keepLocal} onChange={(e) => setKeepLocal(e.target.checked)} />
            Manter cópia local até confirmação explícita
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy || !selected.size} onClick={runMigrate}>
          {busy ? "Migrando…" : "Migrar selecionados"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          Atualizar inventário
        </Button>
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {results.map((r) => (
              <div
                key={r.batchId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
              >
                <div>
                  <Badge tone={r.ok ? "success" : "error"}>{r.syncStatus}</Badge>{" "}
                  <span className="text-slate-300">{r.message}</span>
                </div>
                {r.ok && !keepLocal && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void removeSynced(r.batchId)}>
                    Remover local
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
