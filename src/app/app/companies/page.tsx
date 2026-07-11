"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import { normalizeCnpj, formatCnpj, isValidCnpj } from "@/lib/fiscal/cnpj";
import {
  listCompanies,
  saveCompany,
  listEstablishments,
  saveEstablishment,
  type LocalCompany,
  type LocalEstablishment,
} from "@/lib/store/local-cadastro";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<LocalCompany[]>([]);
  const [establishments, setEstablishments] = useState<LocalEstablishment[]>([]);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [estName, setEstName] = useState("");
  const [ie, setIe] = useState("");
  const [uf, setUf] = useState("SP");
  const [companyId, setCompanyId] = useState("");

  const refresh = useCallback(async () => {
    const c = await listCompanies();
    setCompanies(c);
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
    await saveCompany({
      id: crypto.randomUUID(),
      name: name.trim() || "Empresa sem nome",
      cnpj: n || undefined,
      createdAt: new Date().toISOString(),
    });
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
          Empresas e estabelecimentos
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Cadastro local (IndexedDB). Com Supabase, estes dados migram para tabelas com RLS.
        </p>
      </div>
      <LocalPersistenceBanner />

      <Card>
        <CardHeader>
          <CardTitle>Nova empresa</CardTitle>
          <CardDescription>CNPJ numérico ou alfanumérico (14 posições)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addCompany} className="grid gap-3 sm:grid-cols-2">
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
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!companies.length && <p className="text-slate-500">Nenhuma empresa ainda.</p>}
          {companies.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 px-3 py-2">
              <div className="font-medium text-slate-100">{c.name}</div>
              <div className="text-xs text-slate-500">{c.cnpj ? formatCnpj(c.cnpj) : "sem CNPJ"}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Novo estabelecimento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addEstablishment} className="grid gap-3 sm:grid-cols-2">
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
