"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { FileArchive, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { idbCollectKnownHashes, idbSaveBatchStore } from "@/lib/store/idb-store";
import { processZipBatchInMemory } from "@/lib/store/process-memory";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [cnpjLabel, setCnpjLabel] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [incremental, setIncremental] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  const onDrop = useCallback(
    (accepted: File[]) => {
      const f = accepted[0];
      if (!f) return;
      if (!f.name.toLowerCase().endsWith(".zip")) {
        toast.error("Envie um arquivo .zip");
        return;
      }
      setFile(f);
      if (!name) setName(f.name.replace(/\.zip$/i, ""));
      const m = f.name.match(/(20\d{2})(0[1-9]|1[0-2])/);
      if (m) {
        if (!year) setYear(m[1]);
        if (!month) setMonth(String(Number(m[2])));
      }
    },
    [name, month, year],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "application/zip": [".zip"], "application/x-zip-compressed": [".zip"] },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Selecione um ZIP");
      return;
    }
    setLoading(true);
    setProgress(2);
    setProgressMessage("Lendo ZIP no navegador…");

    try {
      const buffer = await file.arrayBuffer();
      let knownHashes: Set<string> | undefined;
      if (incremental) {
        setProgressMessage("Carregando hashes de lotes anteriores…");
        knownHashes = await idbCollectKnownHashes();
      }

      const store = await processZipBatchInMemory({
        buffer,
        fileName: file.name,
        name: name || undefined,
        cnpjLabel: cnpjLabel || undefined,
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
        keepRawJson: false,
        keepFields: false,
        incremental,
        knownHashes,
        onProgress: (pct, message) => {
          setProgress(Math.min(95, pct));
          setProgressMessage(message);
        },
      });

      if (
        !store.documents.length &&
        store.batch.totalXml === 0 &&
        !(store.batch.skippedDuplicateCount || 0)
      ) {
        throw new Error("Nenhum XML encontrado no ZIP");
      }

      setProgress(97);
      setProgressMessage("Salvando lote no navegador…");
      await idbSaveBatchStore(store);

      try {
        await fetch("/api/batches/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            batch: store.batch,
          }),
        });
      } catch {
        // ignore
      }

      setProgress(100);
      const skipped = store.batch.skippedDuplicateCount || 0;
      toast.success(
        skipped
          ? `Lote: ${store.batch.newDocumentCount} novos · ${skipped} já conhecidos · score ${store.batch.healthScore}`
          : `Lote processado: ${store.batch.validXml} XMLs · ${store.items.length} itens · score ${store.batch.healthScore}`,
      );
      router.push(`/app/batches/${store.batch.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
      setLoading(false);
      setProgress(0);
      setProgressMessage("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Upload de lote
        </h1>
        <p className="text-slate-400 mt-1">
          O ZIP é processado no seu navegador (sem limite de 4,5 MB da Vercel) e salvo localmente no
          IndexedDB.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arquivo ZIP</CardTitle>
          <CardDescription>
            Extração segura, detecção NF-e/CT-e/NFS-e, flatten, auditoria e relacionamentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-2xl border border-dashed p-10 text-center transition ${
                isDragActive
                  ? "border-sky-400 bg-sky-500/10"
                  : "border-white/15 bg-slate-950/40 hover:bg-white/5"
              }`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="mx-auto h-8 w-8 text-sky-300" />
              <p className="mt-3 text-slate-200">
                {file
                  ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`
                  : "Arraste o ZIP ou clique para selecionar"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Apenas .xml internos são lidos. Executáveis e path traversal são bloqueados.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do lote</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="CNPJ · jun/2026"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ / empresa (opcional)</Label>
                <Input
                  id="cnpj"
                  value={cnpjLabel}
                  onChange={(e) => setCnpjLabel(e.target.value)}
                  placeholder="12.345.678/0001-90"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="month">Mês</Label>
                <Input
                  id="month"
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="6"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Ano</Label>
                <Input
                  id="year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2026"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={incremental}
                onChange={(e) => setIncremental(e.target.checked)}
              />
              <span>
                <span className="font-medium text-slate-100">Importação incremental</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Pula XMLs cujo SHA-256 já existe em lotes anteriores neste navegador.
                </span>
              </span>
            </label>

            {loading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> {progressMessage || "Processando lote…"}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading || !file} className="w-full md:w-auto">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando
                </>
              ) : (
                <>
                  <FileArchive className="h-4 w-4" /> Processar ZIP
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 text-sm text-slate-400 space-y-2">
          <p>
            Seu <code className="text-sky-300">202606 NFe.zip</code> (~5,3 MB / ~1.1k NF-e) estourava o
            limite de upload da Vercel. Agora o parse roda no navegador. Dados ficam neste dispositivo
            (IndexedDB) — não vão para o GitHub.
          </p>
          <p className="text-xs text-amber-200/80 border border-amber-500/20 rounded-lg px-3 py-2 bg-amber-500/5">
            Este sistema auxilia análise, organização, auditoria e diagnóstico fiscal, mas não
            substitui validação contábil/fiscal profissional, legislação aplicável, consultoria
            tributária, nem o PVA/SPED oficial.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
