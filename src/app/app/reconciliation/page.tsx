"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField } from "@/components/design-system/SelectField";
import { idbGetBatchStore, idbListBatches } from "@/lib/store/idb-store";
import {
  reconcileBatchDocuments,
  type ReconciliationIssue,
} from "@/modules/reconciliation";

export default function ReconciliationPage() {
  const [issues, setIssues] = useState<Array<ReconciliationIssue & { batchName?: string; batchId?: string }>>(
    [],
  );
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        const batches = await idbListBatches();
        const all: Array<ReconciliationIssue & { batchName?: string; batchId?: string }> = [];
        for (const b of batches.slice(0, 15)) {
          const store = await idbGetBatchStore(b.id);
          if (!store) continue;
          const linked = new Set<string>();
          for (const r of store.relationships || []) {
            if (r.relationshipType === "cte_to_nfe" && r.evidence?.accessKey) {
              linked.add(String(r.evidence.accessKey));
            }
          }
          for (const issue of reconcileBatchDocuments({
            documents: store.documents,
            linkedNfeKeysFromCte: linked,
          })) {
            all.push({ ...issue, batchName: b.name, batchId: b.id });
          }
        }
        if (!cancelled) {
          setIssues(all);
          setLoading(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Conciliação
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Base interna lote a lote (XML vs XML). Integrações ERP/financeiro estão{" "}
          <Badge>Planejado</Badge> — sem conectores fictícios.
        </p>
      </div>

      {issues.length > 0 && (
        <SelectField
          id="severity-filter"
          label="Filtrar pendências por gravidade"
          value={severityFilter}
          onChange={setSeverityFilter}
          options={[
            { value: "all", label: "Todas as gravidades" },
            { value: "error", label: "Erros" },
            { value: "warning", label: "Avisos" },
            { value: "info", label: "Informações" },
          ]}
        />
      )}

      {!issues.length ? (
        <Card>
          <CardContent className="p-6 text-slate-400">
            Nenhuma pendência de conciliação nos lotes locais.{" "}
            <Link href="/app/upload" className="text-sky-300">
              Importar
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {issues
            .filter((i) => severityFilter === "all" || i.severity === severityFilter)
            .slice(0, 200)
            .map((i) => (
            <Card key={`${i.batchId}-${i.id}`} className="bg-slate-900/40">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    tone={
                      i.severity === "error" ? "error" : i.severity === "warning" ? "warning" : "info"
                    }
                  >
                    {i.severity}
                  </Badge>
                  <Badge>{i.kind}</Badge>
                </div>
                <CardTitle className="text-base mt-2">{i.title}</CardTitle>
                <CardDescription>
                  {i.batchName} · {i.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                Fatores: {i.factors.join(" · ")}
                {i.batchId && (
                  <>
                    {" · "}
                    <Link href={`/app/batches/${i.batchId}`} className="text-sky-300">
                      abrir lote
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
