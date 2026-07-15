"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Pencil, Plus, PowerOff, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocalPersistenceBanner } from "@/components/feedback/honesty-banners";
import { PageHeader } from "@/components/design-system/PageHeader";
import { EmptyState } from "@/components/design-system/EmptyState";
import { DataTable } from "@/components/design-system/DataTable";
import { FormField } from "@/components/design-system/FormField";
import { SelectField } from "@/components/design-system/SelectField";
import { FileUpload } from "@/components/design-system/FileUpload";
import { ConfirmationDialog } from "@/components/design-system/ConfirmationDialog";
import { normalizeCnpj, formatCnpj, isValidCnpj, cnpjIncludes, cnpjSearchNeedle } from "@/lib/fiscal/cnpj";
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

function CompanyRowActions({ c, onEdit, onUse, onInactivate, onDelete }: {
  c: LocalCompany;
  onEdit: (c: LocalCompany) => void;
  onUse: (c: LocalCompany) => void;
  onInactivate: (c: LocalCompany) => void;
  onDelete: (c: LocalCompany) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(c)}>
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Editar
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => onUse(c)}>
        Usar em obrigações
      </Button>
      {c.active !== false && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onInactivate(c)}>
          <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
          Inativar
        </Button>
      )}
      <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(c)}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Excluir
      </Button>
    </div>
  );
}

const EDIT_FIELDS = [
  { key: "name", label: "Razão social" },
  { key: "ie", label: "IE" },
  { key: "uf", label: "UF" },
  { key: "codMun", label: "COD_MUN" },
  { key: "cep", label: "CEP" },
  { key: "address", label: "Endereço" },
  { key: "addressNumber", label: "Número" },
  { key: "neighborhood", label: "Bairro" },
] as const;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<LocalCompany[]>([]);
  const [establishments, setEstablishments] = useState<LocalEstablishment[]>([]);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cnpjError, setCnpjError] = useState<string | undefined>();
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
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [inactivateTarget, setInactivateTarget] = useState<LocalCompany | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocalCompany | null>(null);
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
      setCnpjError("CNPJ inválido. Confira os 14 caracteres (numéricos ou alfanuméricos).");
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
        active: true,
        createdAt: new Date().toISOString(),
        source: "manual",
      });
    }
    setName("");
    setCnpj("");
    setCnpjError(undefined);
    setCreateOpen(false);
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

  function cancelEdit() {
    setEditingId(null);
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteCompany(deleteTarget.id);
    setDeleteTarget(null);
    toast.success("Empresa excluída");
    await refresh();
  }

  async function confirmInactivate() {
    if (!inactivateTarget) return;
    const next: LocalCompany = {
      ...inactivateTarget,
      active: false,
      updatedAt: new Date().toISOString(),
    };
    await saveCompany(next);
    setInactivateTarget(null);
    toast.success("Empresa inativada");
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
        toast.error("Nenhum CNPJ encontrado no PDF");
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
      toast.error(err instanceof Error ? err.message : "Falha ao processar o PDF");
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
      toast.error(data.error || "Falha ao sincronizar empresas");
      return;
    }
    toast.success(`${data.saved ?? 0} empresa(s) enviada(s) à nuvem`);
  }

  function markForObligations(c: LocalCompany) {
    if (c.cnpj) setLastCompanyCnpj(c.cnpj);
    toast.success("Empresa marcada como última usada — abra qualquer obrigação");
  }

  const needle = cnpjSearchNeedle(search);
  const filtered = companies.filter((c) => {
    if (!showInactive && c.active === false) return false;
    if (!needle) return true;
    return c.name.toUpperCase().includes(needle) || cnpjIncludes(c.cnpj, needle);
  });

  const companyOptions = companies.map((c) => ({ value: c.id, label: c.name }));

  const columns = [
    {
      key: "name",
      header: "Razão social",
      render: (row: Record<string, unknown>) => (row.company as LocalCompany).name,
    },
    {
      key: "cnpj",
      header: "CNPJ",
      render: (row: Record<string, unknown>) => {
        const c = row.company as LocalCompany;
        return c.cnpj ? formatCnpj(c.cnpj) : "sem CNPJ";
      },
    },
    {
      key: "uf",
      header: "UF",
      render: (row: Record<string, unknown>) => (row.company as LocalCompany).uf || "—",
    },
    {
      key: "ie",
      header: "IE",
      render: (row: Record<string, unknown>) => (row.company as LocalCompany).ie || "—",
    },
    ...(showInactive
      ? [
          {
            key: "status",
            header: "Status",
            render: (row: Record<string, unknown>) =>
              (row.company as LocalCompany).active === false ? "Inativa" : "Ativa",
          },
        ]
      : []),
    {
      key: "actions",
      header: "Ações",
      render: (row: Record<string, unknown>) => {
        const c = row.company as LocalCompany;
        return (
          <CompanyRowActions
            c={c}
            onEdit={startEdit}
            onUse={markForObligations}
            onInactivate={setInactivateTarget}
            onDelete={setDeleteTarget}
          />
        );
      },
    },
  ];

  const rows = filtered.map((c) => ({ company: c }) as Record<string, unknown>);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Empresas e estabelecimentos"
        description="Cadastro local, reutilizado em todas as obrigações. Importe o PDF de clientes ou edite IE/endereço aqui."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void syncCompaniesToCloud()}
              disabled={!companies.length}
            >
              Sincronizar
            </Button>
            <Button type="button" onClick={() => setCreateOpen((o) => !o)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nova empresa
            </Button>
          </>
        }
      />
      <LocalPersistenceBanner />

      {createOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Nova empresa</CardTitle>
            <CardDescription>
              CNPJ numérico ou alfanumérico (14 posições). Deixe em branco para cadastrar sem CNPJ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void addCompany(e)} className="grid gap-3 sm:grid-cols-2">
              <FormField id="co-name" label="Razão social" required className="sm:col-span-2">
                <Input
                  id="co-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </FormField>
              <FormField
                id="co-cnpj"
                label="CNPJ"
                hint="Ex.: 12ABC34501DE35 — 14 caracteres, podendo conter letras."
                error={cnpjError}
                className="sm:col-span-2"
              >
                <Input
                  id="co-cnpj"
                  value={cnpj}
                  onChange={(e) => {
                    setCnpj(e.target.value);
                    setCnpjError(undefined);
                  }}
                  aria-invalid={cnpjError ? true : undefined}
                  placeholder="12ABC34501DE35"
                />
              </FormField>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit">Salvar empresa</Button>
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editingId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Editar empresa</CardTitle>
            <CardDescription>Atualize os dados cadastrais da empresa.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              {EDIT_FIELDS.map(({ key, label }) => (
                <FormField key={key} id={`edit-${key}`} label={label}>
                  <Input
                    id={`edit-${key}`}
                    value={edit[key]}
                    onChange={(e) => setEdit((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </FormField>
              ))}
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="secondary" onClick={cancelEdit}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Importar quadro de clientes (PDF)</CardTitle>
          <CardDescription>
            Mesmo layout da lista «Clientes» do Hub — processado só neste navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FileUpload
            label="Arquivo PDF do quadro de clientes"
            accept="application/pdf,.pdf"
            hint="O PDF não traz IE, COD_MUN e endereço — complete depois na edição."
            onChange={(files) => void importPdf(files?.[0])}
          />
          {pdfBusy && (
            <p className="text-xs text-slate-400" role="status">
              Processando PDF…
            </p>
          )}
          <p className="text-xs text-slate-300">
            Após importar, use as empresas em{" "}
            <Link href="/app/obligations" className="text-sky-300 underline underline-offset-2">
              Obrigações
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empresas</CardTitle>
          <CardDescription>
            {companies.length} no cadastro{companies.length !== filtered.length ? ` · ${filtered.length} exibida(s)` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="sm:max-w-xs sm:flex-1">
              <FormField
                id="company-search"
                label="Buscar por nome ou CNPJ"
                className="w-full"
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                  <Input
                    id="company-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    placeholder="Nome ou CNPJ"
                  />
                </div>
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-slate-950"
              />
              Mostrar inativas
            </label>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={companies.length === 0 ? "Nenhuma empresa cadastrada" : "Nenhum resultado"}
              description={
                companies.length === 0
                  ? "Importe um PDF de clientes ou cadastre a primeira empresa manualmente."
                  : "Ajuste a busca ou mostre as empresas inativas."
              }
              action={
                companies.length === 0 ? (
                  <Button type="button" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Nova empresa
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataTable columns={columns} rows={rows} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Novo estabelecimento</CardTitle>
          <CardDescription>Víncule um estabelecimento a uma empresa cadastrada.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void addEstablishment(e)} className="grid gap-3 sm:grid-cols-2">
            <SelectField
              id="est-co"
              label="Empresa"
              className="sm:col-span-2"
              value={companyId}
              onChange={setCompanyId}
              options={companyOptions}
              placeholder="Selecione a empresa"
              required
            />
            <FormField id="est-name" label="Nome">
              <Input id="est-name" value={estName} onChange={(e) => setEstName(e.target.value)} />
            </FormField>
            <FormField id="est-uf" label="UF">
              <Input
                id="est-uf"
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                maxLength={2}
              />
            </FormField>
            <FormField id="est-ie" label="IE" className="sm:col-span-2">
              <Input id="est-ie" value={ie} onChange={(e) => setIe(e.target.value)} />
            </FormField>
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
                  <div className="text-xs text-slate-300">
                    {co?.name || "?"} · {e.uf} · IE {e.ie || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={inactivateTarget !== null}
        title="Inativar empresa?"
        message={
          inactivateTarget
            ? `«${inactivateTarget.name}» será oculta da listagem, mas permanecerá no cadastro local.`
            : undefined
        }
        confirmLabel="Inativar"
        destructive
        onConfirm={() => void confirmInactivate()}
        onCancel={() => setInactivateTarget(null)}
      />

      <ConfirmationDialog
        open={deleteTarget !== null}
        title="Excluir empresa?"
        message={
          deleteTarget
            ? `«${deleteTarget.name}» será removida permanentemente do cadastro local.`
            : undefined
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
