"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Badge, typeTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { searchBatchStore, searchAllStores } from "@/lib/search";
import { idbGetBatchStore, idbListBatches, mergeBatchLists } from "@/lib/store/idb-store";
import type { Batch, BatchStore, SearchResult } from "@/types";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [batchId, setBatchId] = useState("");
  const [type, setType] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/batches");
        const data = await res.json();
        setBatches(await mergeBatchLists(data.batches || []));
      } catch {
        setBatches(await mergeBatchLists([]));
      }
    })();
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        // Prefer IndexedDB (client-processed lots)
        if (batchId) {
          const store = await idbGetBatchStore(batchId);
          if (store) {
            setResults(searchBatchStore(store, query, { documentType: type || undefined, limit: 80 }));
            return;
          }
        } else {
          const localBatches = await idbListBatches();
          const stores: BatchStore[] = [];
          for (const b of localBatches) {
            const s = await idbGetBatchStore(b.id);
            if (s) stores.push(s);
          }
          if (stores.length) {
            const localResults = type
              ? stores.flatMap((s) => searchBatchStore(s, query, { documentType: type, limit: 40 }))
              : searchAllStores(stores, query, 80);
            if (localResults.length) {
              setResults(localResults.slice(0, 80));
              return;
            }
          }
        }

        const params = new URLSearchParams({ q: query });
        if (batchId) params.set("batchId", batchId);
        if (type) params.set("type", type);
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        setResults(data.results || []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, batchId, type]);

  const visibleResults = q.trim() ? results : [];

  const grouped = {
    document: visibleResults.filter((r) => r.kind === "document"),
    item: visibleResults.filter((r) => r.kind === "item"),
    field: visibleResults.filter((r) => r.kind === "field"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Busca global
        </h1>
        <p className="text-slate-400 mt-1">
          Chave, CNPJ, produto, CFOP, NCM, município ou qualquer tag/texto.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              className="pl-10"
              placeholder="Buscar em documentos, itens e campos..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">Todos os lotes</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              <option value="NFE">NF-e</option>
              <option value="CTE">CT-e</option>
              <option value="NFSE">NFS-e</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="skeleton h-24 rounded-2xl" />}

      {!loading && q.trim() && visibleResults.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-slate-400">
          Nenhum resultado para “{q}”.
        </div>
      )}

      {(["document", "item", "field"] as const).map((kind) =>
        grouped[kind].length ? (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="capitalize">
                {kind === "document" ? "Documentos" : kind === "item" ? "Itens" : "Campos/tags"} (
                {grouped[kind].length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {grouped[kind].map((r, idx) => (
                <Link
                  key={`${r.documentId}-${r.matchedField}-${idx}`}
                  href={`/app/batches/${r.batchId}/documents/${r.documentId}`}
                  className="block rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 hover:bg-white/5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={typeTone(r.documentType)}>{r.documentType}</Badge>
                    <span className="font-medium text-slate-100">{r.title}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {r.matchedField && (
                      <span className="text-sky-300/80">em {r.matchedField} · </span>
                    )}
                    {r.preview}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {r.emitterName || "—"} → {r.receiverName || "—"} · {formatDate(r.issueDate)} ·{" "}
                    {formatCurrency(r.totalValue)}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null,
      )}
    </div>
  );
}
