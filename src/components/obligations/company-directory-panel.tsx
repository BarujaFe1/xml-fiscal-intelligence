"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  extractPdfText,
  formatDocMask,
  parseCompanyDirectoryPdfText,
  type CompanyDirectoryEntry,
  type CompanyDirectoryRichEntry,
} from "@/modules/company-directory";
import {
  ensureDefaultEstablishment,
  listCompanies,
  listEstablishments,
  localCompanyToFiscalPatch,
  upsertCompanyByCnpj,
  type CompanyFiscalPatch,
  type LocalCompany,
  type LocalEstablishment,
} from "@/lib/store/local-cadastro";
import { getLastCompanyCnpj, setLastCompanyCnpj } from "@/lib/store/last-company";
import { formatCnpj } from "@/lib/fiscal/cnpj";
import type { InformantSuggestion } from "@/modules/obligations/efd-icms-ipi/suggest-informant";

export type CompanyDirectoryApply = CompanyFiscalPatch & {
  /** Resolved local company id when known */
  companyId?: string;
};

type Props = {
  onApply: (patch: CompanyDirectoryApply) => void;
  /** Current form snapshot — used by «Salvar formulário no cadastro». */
  currentForm?: CompanyFiscalPatch;
  /** Enrich from lote XML when applying a CNPJ. */
  enrichFromBatch?: (cnpj: string) => InformantSuggestion | null;
  /** Persist merge back to IDB when enriching from XML. */
  persistEnrich?: boolean;
  allowCpf?: boolean;
  className?: string;
};

export function CompanyDirectoryPanel({
  onApply,
  currentForm,
  enrichFromBatch,
  persistEnrich = true,
  allowCpf = false,
  className,
}: Props) {
  const [companies, setCompanies] = useState<LocalCompany[]>([]);
  const [establishments, setEstablishments] = useState<LocalEstablishment[]>([]);
  const [savedFilter, setSavedFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfEntries, setPdfEntries] = useState<CompanyDirectoryEntry[]>([]);
  const [rich, setRich] = useState<CompanyDirectoryRichEntry | null>(null);
  const [pdfFilter, setPdfFilter] = useState("");
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const inputId = "company-directory-pdf";

  const refresh = useCallback(async () => {
    setCompanies(await listCompanies());
    setEstablishments(await listEstablishments());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
      const last = getLastCompanyCnpj();
      if (!last || !currentForm?.cnpj) return;
      // only auto-hint when form still empty of name
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, currentForm?.cnpj]);

  const cnpjCompanies = useMemo(
    () =>
      companies
        .filter((c) => {
          const d = (c.cnpj || "").replace(/\D/g, "");
          if (!allowCpf && (c.kind === "cpf" || d.length === 11)) return false;
          return !!d;
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [companies, allowCpf],
  );

  const visibleSaved = useMemo(() => {
    const q = savedFilter.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    if (!q) return cnpjCompanies;
    return cnpjCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (digits && (c.cnpj || "").replace(/\D/g, "").includes(digits)),
    );
  }, [cnpjCompanies, savedFilter]);

  const lastCnpj = getLastCompanyCnpj();

  async function applyCompany(c: LocalCompany, fromPdfRich?: CompanyDirectoryRichEntry | null) {
    const doc = (c.cnpj || "").replace(/\D/g, "");
    if (!doc) {
      toast.error("Empresa sem CNPJ/CPF");
      return;
    }
    if (!allowCpf && (c.kind === "cpf" || doc.length === 11)) {
      toast.error("Selecione um CNPJ para o estabelecimento informante");
      return;
    }

    let working = c;
    const fromBatch = enrichFromBatch?.(doc) || null;
    if (fromBatch || fromPdfRich) {
      working = await upsertCompanyByCnpj({
        name: fromBatch?.name || fromPdfRich?.name || c.name,
        cnpj: doc,
        kind: doc.length === 14 ? "cnpj" : "cpf",
        ie: fromBatch?.ie || fromPdfRich?.ie || c.ie,
        uf: fromBatch?.uf || fromPdfRich?.uf || c.uf,
        codMun: fromBatch?.codMun || fromPdfRich?.codMun || c.codMun,
        cep: fromBatch?.cep || fromPdfRich?.cep || c.cep,
        address: fromBatch?.address || fromPdfRich?.address || c.address,
        addressNumber: fromBatch?.addressNumber || fromPdfRich?.addressNumber || c.addressNumber,
        neighborhood: fromBatch?.neighborhood || fromPdfRich?.neighborhood || c.neighborhood,
        source: fromBatch ? "xml-lote" : c.source || "sieg-pdf",
      });
      if (persistEnrich) await ensureDefaultEstablishment(working);
      await refresh();
    }

    const est =
      establishments.find((e) => e.companyId === working.id) ||
      (await ensureDefaultEstablishment(working));
    const patch = localCompanyToFiscalPatch(working, est);
    setLastCompanyCnpj(doc);
    onApply({ ...patch, companyId: working.id });

    if (fromBatch) {
      toast.success(
        `Empresa aplicada · enriquecida com ${fromBatch.count} NF-e do lote (${working.name})`,
      );
    } else if (!working.ie || !working.address) {
      toast.success(
        "Empresa aplicada do cadastro. Complete IE/endereço se ainda faltarem (PDF SIEG não traz).",
      );
    } else {
      toast.success(`Empresa aplicada: ${working.name}`);
    }
  }

  async function onPdfFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    setBusy(true);
    setPdfEntries([]);
    setRich(null);
    setFileLabel(file.name);
    try {
      const text = await extractPdfText(await file.arrayBuffer());
      const parsed = parseCompanyDirectoryPdfText(text);
      if (!parsed.entries.length) {
        toast.error(parsed.warnings[0] || "Nenhuma empresa encontrada no PDF");
        return;
      }
      setPdfEntries(parsed.entries);
      setRich(parsed.rich ?? null);
      toast.success(
        `${parsed.entries.length} lido(s). Salve no cadastro ou use uma empresa abaixo.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler o PDF");
      setFileLabel(null);
    } finally {
      setBusy(false);
      const el = document.getElementById(inputId) as HTMLInputElement | null;
      if (el) el.value = "";
    }
  }

  async function saveAllPdfToCadastro() {
    const toSave = pdfEntries.filter((e) => allowCpf || e.kind === "cnpj");
    if (!toSave.length) {
      toast.error("Nenhum CNPJ para salvar");
      return;
    }
    setBusy(true);
    try {
      let saved = 0;
      let updated = 0;
      for (const e of toSave) {
        const before = await listCompanies().then((all) =>
          all.find((c) => (c.cnpj || "").replace(/\D/g, "") === e.document),
        );
        const co = await upsertCompanyByCnpj({
          name: e.name,
          cnpj: e.document,
          kind: e.kind,
          source: "sieg-pdf",
          ...(rich?.document === e.document
            ? {
                ie: rich.ie,
                uf: rich.uf,
                cep: rich.cep,
                codMun: rich.codMun,
                address: rich.address,
                addressNumber: rich.addressNumber,
                neighborhood: rich.neighborhood,
              }
            : {}),
        });
        await ensureDefaultEstablishment(co);
        if (before) updated += 1;
        else saved += 1;
      }
      await refresh();
      toast.success(`Cadastro atualizado: ${saved} nova(s) · ${updated} atualizada(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function applyPdfEntry(e: CompanyDirectoryEntry) {
    const co = await upsertCompanyByCnpj({
      name: e.name,
      cnpj: e.document,
      kind: e.kind,
      source: "sieg-pdf",
      ...(rich?.document === e.document
        ? {
            ie: rich.ie,
            uf: rich.uf,
            cep: rich.cep,
            codMun: rich.codMun,
            address: rich.address,
            addressNumber: rich.addressNumber,
            neighborhood: rich.neighborhood,
          }
        : {}),
    });
    await ensureDefaultEstablishment(co);
    await refresh();
    await applyCompany(co, rich?.document === e.document ? rich : null);
  }

  async function saveCurrentForm() {
    const cnpj = (currentForm?.cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14 && cnpj.length !== 11) {
      toast.error("Informe um CNPJ válido no formulário antes de salvar");
      return;
    }
    const co = await upsertCompanyByCnpj({
      name: currentForm?.companyName || "Empresa",
      cnpj,
      kind: cnpj.length === 14 ? "cnpj" : "cpf",
      ie: currentForm?.ie,
      uf: currentForm?.uf,
      codMun: currentForm?.codMun,
      cep: currentForm?.cep,
      address: currentForm?.address,
      addressNumber: currentForm?.addressNumber,
      neighborhood: currentForm?.neighborhood,
      tradeName: currentForm?.tradeName,
      accountantName: currentForm?.accountantName,
      accountantCpf: currentForm?.accountantCpf,
      accountantCrc: currentForm?.accountantCrc,
      source: "form",
    });
    await ensureDefaultEstablishment(co);
    setLastCompanyCnpj(cnpj);
    await refresh();
    toast.success("Formulário salvo no cadastro local de empresas");
  }

  const visiblePdf = pdfEntries.filter((e) => {
    if (!allowCpf && e.kind === "cpf") return false;
    if (!pdfFilter.trim()) return true;
    const q = pdfFilter.trim().toLowerCase();
    return e.name.toLowerCase().includes(q) || e.document.includes(q.replace(/\D/g, ""));
  });

  return (
    <div className={className ?? "space-y-4 md:col-span-2 sm:col-span-2"}>
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-100">Empresas cadastradas</p>
            <p className="text-xs text-slate-400">
              Cadastro local ·{" "}
              <Link href="/app/companies" className="text-sky-300 hover:underline">
                gerenciar
              </Link>
              {lastCnpj ? ` · última: ${formatCnpj(lastCnpj)}` : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void refresh()}>
              Atualizar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!currentForm?.cnpj}
              onClick={() => void saveCurrentForm()}
            >
              Salvar formulário no cadastro
            </Button>
          </div>
        </div>
        {cnpjCompanies.length ? (
          <>
            <Input
              placeholder="Filtrar cadastro por nome ou CNPJ…"
              value={savedFilter}
              onChange={(e) => setSavedFilter(e.target.value)}
            />
            <ul className="max-h-44 overflow-y-auto divide-y divide-white/5 text-sm">
              {visibleSaved.map((c) => {
                const isLast = lastCnpj && (c.cnpj || "").replace(/\D/g, "") === lastCnpj;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">
                        {c.name}
                        {isLast ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-sky-300">
                            última
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {c.cnpj ? formatCnpj(c.cnpj) : "—"}
                        {c.uf ? ` · ${c.uf}` : ""}
                        {c.ie ? ` · IE ${c.ie}` : " · sem IE"}
                        {c.source ? ` · ${c.source}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isLast ? "default" : "secondary"}
                      onClick={() => void applyCompany(c)}
                    >
                      Usar
                    </Button>
                  </li>
                );
              })}
              {!visibleSaved.length ? (
                <li className="py-2 text-xs text-slate-500">Nenhuma empresa no filtro.</li>
              ) : null}
            </ul>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            Nenhuma empresa salva ainda. Importe o PDF SIEG abaixo ou cadastre em Empresas.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-dashed border-white/15 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 grow min-w-[12rem]">
            <Label htmlFor={inputId}>Importar PDF (SIEG / cadastro)</Label>
            <Input
              id={inputId}
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(e) => void onPdfFile(e.target.files?.[0])}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || !pdfEntries.length}
            onClick={() => void saveAllPdfToCadastro()}
          >
            Salvar todas no cadastro
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          Lista «Clientes» do SIEG Hub — só no navegador. O PDF não traz IE/endereço; complete pelo
          lote XML ou pelo formulário e depois «Salvar formulário no cadastro».
          {fileLabel ? (
            <>
              {" "}
              Arquivo: <span className="text-slate-300">{fileLabel}</span>
            </>
          ) : null}
        </p>
        {pdfEntries.length > 0 ? (
          <div className="space-y-2">
            <Input
              placeholder="Filtrar PDF…"
              value={pdfFilter}
              onChange={(e) => setPdfFilter(e.target.value)}
            />
            <ul className="max-h-48 overflow-y-auto divide-y divide-white/5 text-sm">
              {visiblePdf.map((e) => (
                <li
                  key={`${e.kind}-${e.document}`}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">{e.name}</p>
                    <p className="text-xs text-slate-400">
                      {e.kind.toUpperCase()} {formatDocMask(e.document, e.kind)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void applyPdfEntry(e)}
                  >
                    Usar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
