"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { FileArchive, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [cnpjLabel, setCnpjLabel] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".zip")) {
      toast.error("Envie um arquivo .zip");
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.zip$/i, ""));
  }, [name]);

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
    setProgress(10);
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    if (cnpjLabel) form.append("cnpjLabel", cnpjLabel);
    if (month) form.append("month", month);
    if (year) form.append("year", year);

    const tick = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 3 : p));
    }, 400);

    try {
      const res = await fetch("/api/batches", { method: "POST", body: form });
      const data = await res.json();
      clearInterval(tick);
      if (!res.ok) throw new Error(data.error || "Falha no processamento");
      setProgress(100);
      toast.success("Lote processado");
      router.push(`/app/batches/${data.batch.id}`);
    } catch (err) {
      clearInterval(tick);
      toast.error(err instanceof Error ? err.message : "Erro no upload");
      setLoading(false);
      setProgress(0);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Upload de lote
        </h1>
        <p className="text-slate-400 mt-1">
          Envie o ZIP baixado do SIEG (ou samples anonimizados). Limite padrão: 50MB.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arquivo ZIP</CardTitle>
          <CardDescription>
            Extração segura, detecção NF-e/CT-e/NFS-e e flatten de todas as tags.
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
                {file ? file.name : "Arraste o ZIP ou clique para selecionar"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Apenas .xml internos são lidos. Executáveis e path traversal são bloqueados.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do lote</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="CNPJ · Mar/2026" />
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
                  placeholder="3"
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

            {loading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando lote…
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
        <CardContent className="p-5 text-sm text-slate-400">
          Para testar com ZIP real: coloque em <code className="text-sky-300">private-test-data/lote-xml.zip</code>{" "}
          (já no .gitignore) e faça upload pela UI. Nunca commite XMLs reais.
        </CardContent>
      </Card>
    </div>
  );
}
