"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import { normalizeCnpj, formatCnpj, isValidCnpj } from "@/lib/fiscal/cnpj";
import {
  deleteCompany,
  ensureDefaultEstablishment,
  listCompanies,
  listEstablishments,
  saveCompany,
  saveEstablishment,
  upsertCompanyByCnpj,
  type LocalCompany,
  type LocalEstablishment,
} from "@/lib/store/local-cadastro";
import { setLastCompanyCnpj } from "@/lib/store/last-company";
import {
  extractPdfText,
  parseCompanyDirectoryPdfText,
} from "@/modules/company-directory";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<LocalCompany[]>([]);
  const [establishments, setEstablishments] = useState<LocalEstablishment[]>([]);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [estName, setEstName] = useState("");
  const [ie, setIe] = useState("");
  const [uf, setUf] = useState("SP");
  const [companyId, setCompanyId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    name: "",
    ie: "",
    uf: "SP",
    codMun: "",
    cep: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
  });
  const [pdfBusy, setPdfBusy] = useState(false);

  const refresh = useCallback(async () => {
    const c = await listCompanies();
    setCompanies(c.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    setEstablishments(await listEstablishments());
    setCompanyId((prev) => prev || c[0]?.id || "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        if (cancelled) return;
        await refresh();
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function addCompany(e: React.FormEvent) {
    e.preventDefault();
    const n = normalizeCnpj(cnpj);
    if (n && !isValidCnpj(n)) {
      toast.error("CNPJ inválido (numérico ou alfanumérico)");
      return;
    }
    if (n) {
      const co = await upsertCompanyByCnpj({
        name: name.trim() || "Empresa sem nome",
        cnpj: n,
        kind: "cnpj",
        source: "manual",
      });
      await ensureDefaultEstablishment(co);
    } else {
      await saveCompany({
        id: crypto.randomUUID(),
        name: name.trim() || "Empresa sem nome",
        createdAt: new Date().toISOString(),
        source: "manual",
      });
    }
    setName("");
    setCnpj("");
    toast.success("Empresa salva localmente");
    await refresh();
  }

  async function addEstablishment(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) {
      toast.error("Selecione uma empresa");
      return;
    }
    await saveEstablishment({
      id: crypto.randomUUID(),
      companyId,
      name: estName.trim() || "Matriz",
      ie: ie.trim() || undefined,
      uf: uf.trim().toUpperCase().slice(0, 2),
      createdAt: new Date().toISOString(),
    });
    setEstName("");
    setIe("");
    toast.success("Estabelecimento salvo localmente");
    await refresh();
  }

  function startEdit(c: LocalCompany) {
    setEditingId(c.id);
    setEdit({
      name: c.name,
      ie: c.ie || "",
      uf: c.uf || "SP",
      codMun: c.codMun || "",
      cep: c.cep || "",
      address: c.address || "",
      addressNumber: c.addressNumber || "",
      neighborhood: c.neighborhood || "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    const c = companies.find((x) => x.id === editingId);
    if (!c) return;
    const next: LocalCompany = {
      ...c,
      name: edit.name.trim() || c.name,
      ie: edit.ie.trim() || undefined,
      uf: edit.uf.trim().toUpperCase().slice(0, 2) || undefined,
      codMun: edit.codMun.trim() || undefined,
      cep: edit.cep.trim() || undefined,
      address: edit.address.trim() || undefined,
      addressNumber: edit.addressNumber.trim() || undefined,
      neighborhood: edit.neighborhood.trim() || undefined,
      updatedAt: new Date().toISOString(),
      source: c.source === "sieg-pdf" || c.source === "xml-lote" ? "merged" : c.source || "manual",
    };
    await saveCompany(next);
    await ensureDefaultEstablishment(next);
    setEditingId(null);
    toast.success("Empresa atualizada");
    await refresh();
  }

  async function removeCompany(id: string) {
    if (!confirm("Excluir esta empresa do cadastro local?")) return;
    await deleteCompany(id);
    toast.success("Empresa excluída");
    await refresh();
  }

  async function importPdf(file: File | undefined) {
    if (!file) return;
    setPdfBusy(true);
    try {
      const text = await extractPdfText(await file.arrayBuffer());
      const parsed = parseCompanyDirectoryPdfText(text);
      const cnpjs = parsed.entries.filter((e) => e.kind === "cnpj");
      if (!cnpjs.length) {
        toast.error("Nenhum CNPJ no PDF");
        return;
      }
      let n = 0;
      for (const e of cnpjs) {
        const co = await upsertCompanyByCnpj({
          name: e.name,
          cnpj: e.document,
          kind: "cnpj",
          source: "sieg-pdf",
        });
        await ensureDefaultEstablishment(co);
        n += 1;
      }
      await refresh();
      toast.success(`${n} empresa(s) do PDF salvas no cadastro (CPFs ignorados aqui)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  async function syncCompaniesToCloud() {
    const ws =
      (typeof localStorage !== "undefined" && localStorage.getItem("xfi:workspace-id")) ||
      crypto.randomUUID();
    if (typeof localStorage !== "undefined") localStorage.setItem("xfi:workspace-id", ws);
    const res = await fetch("/api/companies/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: ws,
        companies: companies.map((c) => ({
          id: c.id,
          name: c.name,
          cnpj: c.cnpj,
          kind: c.kind,
          ie: c.ie,
          uf: c.uf,
          codMun: c.codMun,
          cep: c.cep,
          address: c.address,
          addressNumber: c.addressNumber,
          neighborhood: c.neighborhood,
          source: c.source,
        })),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; saved?: number };
    if (!res.ok) {
      toast.error(data.error || "Falha ao sincronizar empresas (ative FEATURE_CLOUD_PROCESSING)");
      return;
    }
    toast.success(`${data.saved ?? 0} empresa(s) enviada(s) à nuvem`);
  }

  function markForObligations(c: LocalCompany) {
    if (c.cnpj) setLastCompanyCnpj(c.cnpj);
    toast.success("Empresa marcada como última usada — abra qualquer obrigação");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Empresas e estabelecimentos
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Cadastro local (IndexedDB), reutilizado em todas as obrigações. Importe o PDF SIEG de
          clientes ou edite IE/endereço aqui.
        </p>
      </div>
      <LocalPersistenceBanner />

      <Card>
        <CardHeader>
          <CardTitle>Importar PDF SIEG</CardTitle>
          <CardDescription>
            Mesmo layout da lista «Clientes» do Hub — processado só neste navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="file"
            accept="application/pdf,.pdf"
            disabled={pdfBusy}
            onChange={(e) => void importPdf(e.target.files?.[0])}
          />
          <p className="text-xs text-slate-500">
            Depois complete IE, COD_MUN e endereço (o PDF não traz) e use em{" "}
            <Link href="/app/obligations" className="text-sky-300 hover:underline">
              Obrigações
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nova empresa</CardTitle>
          <CardDescription>CNPJ numérico ou alfanumérico (14 posições)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void addCompany(e)} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="co-name">Razão social</Label>
              <Input id="co-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="co-cnpj">CNPJ</Label>
              <Input
                id="co-cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="12.ABC.345/01DE-35"
              />
            </div>
            <Button type="submit">Salvar empresa</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empresas ({companies.length})</CardTitle>
          <CardDescription className="flex flex-wrap gap-2 items-center">
            Cadastro local reutilizado nas obrigações.
            <Button type="button" size="sm" variant="secondary" onClick={() => void syncCompaniesToCloud()}>
              Sincronizar com nuvem
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!companies.length && <p className="text-slate-500">Nenhuma empresa ainda.</p>}
          {companies.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 px-3 py-3 space-y-2">
              {editingId === c.id ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["name", "Razão social"],
                      ["ie", "IE"],
                      ["uf", "UF"],
                      ["codMun", "COD_MUN"],
                      ["cep", "CEP"],
                      ["address", "Endereço"],
                      ["addressNumber", "Número"],
                      ["neighborhood", "Bairro"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label>{label}</Label>
                      <Input
                        value={edit[key]}
                        onChange={(e) => setEdit((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2 flex gap-2">
                    <Button type="button" size="sm" onClick={() => void saveEdit()}>
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-medium text-slate-100">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {c.cnpj ? formatCnpj(c.cnpj) : "sem CNPJ"}
                    {c.uf ? ` · ${c.uf}` : ""}
                    {c.ie ? ` · IE ${c.ie}` : ""}
                    {c.address ? ` · ${c.address}` : ""}
                    {c.source ? ` · origem ${c.source}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(c)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => markForObligations(c)}
                    >
                      Usar em obrigações
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void removeCompany(c.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Novo estabelecimento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void addEstablishment(e)} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="est-co">Empresa</Label>
              <select
                id="est-co"
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="est-name">Nome</Label>
              <Input id="est-name" value={estName} onChange={(e) => setEstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="est-uf">UF</Label>
              <Input id="est-uf" value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="est-ie">IE</Label>
              <Input id="est-ie" value={ie} onChange={(e) => setIe(e.target.value)} />
            </div>
            <Button type="submit" disabled={!companies.length}>
              Salvar estabelecimento
            </Button>
          </form>
          <div className="mt-4 space-y-2 text-sm">
            {establishments.map((e) => {
              const co = companies.find((c) => c.id === e.companyId);
              return (
                <div key={e.id} className="rounded-xl border border-white/10 px-3 py-2">
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-slate-500">
                    {co?.name || "?"} · {e.uf} · IE {e.ie || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
