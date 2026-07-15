"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { PageHeader } from "@/components/design-system/PageHeader";
import { FormField } from "@/components/design-system/FormField";
import { SelectField } from "@/components/design-system/SelectField";
import { FileUpload } from "@/components/design-system/FileUpload";
import { Alert } from "@/components/design-system/Alert";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { DataTable } from "@/components/design-system/DataTable";
import type { EfdVerificationStatus } from "@/modules/obligations/efd-icms-ipi/verification-types";

type Severity = "error" | "warning";

interface ParsedIssue {
  index: number;
  raw: string;
  severity: Severity;
  recordCode?: string;
  fieldNumber?: number;
}

const DEMO_GENERATIONS = [
  { value: "demo-gen-2026-06", label: "Geração demo — 2026-06 (estabelecimento demo)" },
  { value: "local-current", label: "Geração local atual" },
];

const ENVIRONMENTS = [
  { value: "producao", label: "Produção" },
  { value: "homologacao", label: "Homologação" },
];

function detectSeverity(line: string): Severity {
  if (/erro|error/i.test(line)) return "error";
  if (/aviso|warning/i.test(line)) return "warning";
  return "error";
}

function parseReport(text: string): ParsedIssue[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw, index) => {
      const severity = detectSeverity(raw);
      const reg = raw.match(/registro\s+(\d{4})/i) || raw.match(/\b(\d{4})\b/);
      const field = raw.match(/campo\s*(\d+)/i);
      return {
        index,
        raw,
        severity,
        recordCode: reg ? reg[1] : undefined,
        fieldNumber: field ? Number(field[1]) : undefined,
      };
    });
}

function responsibleAreaFor(recordCode?: string): { label: string; href: string } {
  switch (recordCode) {
    case "0000":
    case "0005":
    case "0150":
      return { label: "Cadastro da empresa", href: "/app/companies" };
    case "E100":
    case "E110":
    case "E116":
      return { label: "Configurações fiscais", href: "/app/settings" };
    case "0200":
    case "C100":
    case "C170":
    case "C190":
    case "9999":
    default:
      return { label: "Geração EFD", href: "/app/obligations/efd-icms-ipi" };
  }
}

export default function PvaValidationPage() {
  const [generationId, setGenerationId] = useState(() => {
    if (typeof window !== "undefined") {
      const fromQuery = new URLSearchParams(window.location.search).get("generationId");
      if (fromQuery) return fromQuery;
    }
    return DEMO_GENERATIONS[0].value;
  });
  const [pvaVersion, setPvaVersion] = useState("6.1.0");
  const [reportText, setReportText] = useState("");
  const [executedAt, setExecutedAt] = useState(new Date().toISOString().slice(0, 10));
  const [environment, setEnvironment] = useState("homologacao");
  const [responsible, setResponsible] = useState("");
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<EfdVerificationStatus | null>(null);
  const [submitNote, setSubmitNote] = useState("");

  const parsed = useMemo(() => parseReport(reportText), [reportText]);
  const errorCount = parsed.filter((p) => p.severity === "error").length;
  const warningCount = parsed.filter((p) => p.severity === "warning").length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!generationId || !pvaVersion) {
      toast.error("Geração e versão do PVA são obrigatórias.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/obligations/efd-icms-ipi/pva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          pvaVersion,
          resultStatus: errorCount > 0 ? "errors" : warningCount > 0 ? "warnings" : "ok",
          reportText,
          validatedAt: new Date(executedAt).toISOString(),
          recordedBy: responsible || "user",
          notes:
            `Ambiente: ${environment}.` +
            (attachmentNames.length ? ` Anexos: ${attachmentNames.join(", ")}.` : ""),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; note?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Falha ao registrar validação no PVA.");
      }
      // STATUS HONESTO: só rejeitado quando há erros. Nunca marcamos como aceito
      // a partir de um registro manual — a aceitação exige evidência do PVA.
      const status: EfdVerificationStatus =
        errorCount > 0 ? "pva_rejected" : "pva_pending";
      setSubmittedStatus(status);
      setSubmitNote(data.note || "Registro registrado.");
      toast.success("Validação do PVA registrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Validação no PVA"
        description="Registre o resultado da validação obtida no PVA oficial. O sistema não executa o PVA nem declara conformidade automática."
      />

      <Alert tone="info" title="Como funciona">
        Cole abaixo as mensagens do relatório do PVA. Cada linha é mapeada ao registro e campo
        correspondentes para facilitar a correção. Nenhum resultado é inventado — registramos apenas
        o que você informa.
      </Alert>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            id="generation"
            label="Geração"
            value={generationId}
            onChange={setGenerationId}
            options={DEMO_GENERATIONS}
            required
          />
          <FormField id="pvaVersion" label="Versão do PVA" required>
            <input
              id="pvaVersion"
              value={pvaVersion}
              onChange={(e) => setPvaVersion(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[16px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </FormField>
          <FormField id="executedAt" label="Data de execução" required>
            <input
              id="executedAt"
              type="date"
              value={executedAt}
              onChange={(e) => setExecutedAt(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[16px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </FormField>
          <SelectField
            id="environment"
            label="Ambiente"
            value={environment}
            onChange={setEnvironment}
            options={ENVIRONMENTS}
            required
          />
        </div>

        <FormField
          id="responsible"
          label="Responsável"
          hint="Quem executou a validação no PVA."
        >
          <input
            id="responsible"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder="Nome ou matrícula"
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[16px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </FormField>

        <FileUpload
          label="Anexos do relatório (PDF/TXT)"
          accept=".pdf,.txt"
          multiple
          hint="Opcional. Capturamos apenas os nomes dos arquivos."
          onChange={(files) => {
            if (files) setAttachmentNames(Array.from(files).map((f) => f.name));
            else setAttachmentNames([]);
          }}
        />

        <FormField
          id="reportText"
          label="Mensagens do PVA"
          hint="Cole as linhas de erro/aviso do relatório. Ex.: ERRO Registro 0000 Campo 11 COD_MUN obrigatório."
          required
        >
          <textarea
            id="reportText"
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            rows={8}
            placeholder={"ERRO Registro 0000 Campo 11 COD_MUN obrigatório\nAVISO Registro 0150 Campo 9 COD_MUN inválido"}
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[15px] text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </FormField>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-50"
          >
            {busy ? "Registrando..." : "Registrar validação"}
          </button>
          {submittedStatus && (
            <span className="flex items-center gap-2 text-sm text-slate-300">
              Status: <StatusBadge status={submittedStatus} />
            </span>
          )}
        </div>
        {submitNote && (
          <p className="text-xs text-slate-500">{submitNote}</p>
        )}
      </form>

      {parsed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">
              Mensagens mapeadas
            </h2>
            <span className="text-xs text-slate-400">
              {errorCount} erro(s) · {warningCount} aviso(s)
            </span>
          </div>
          <DataTable
            columns={[
              { key: "severity", header: "Tipo", render: (r) => (
                <span className={r.severity === "error" ? "text-rose-300" : "text-amber-300"}>
                  {r.severity === "error" ? "Erro" : "Aviso"}
                </span>
              ) },
              { key: "recordCode", header: "Registro", render: (r) => String(r.recordCode ?? "—") },
              { key: "fieldNumber", header: "Campo", render: (r) => String(r.fieldNumber ?? "—") },
              { key: "raw", header: "Mensagem" },
              {
                key: "action",
                header: "Ação",
                render: (r) => {
                  const area = responsibleAreaFor(r.recordCode as string | undefined);
                  return (
                    <Link
                      href={area.href}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-100 hover:bg-sky-400/20"
                    >
                      Corrigir informação
                    </Link>
                  );
                },
              },
            ]}
            rows={parsed.map((p) => ({
              severity: p.severity,
              recordCode: p.recordCode,
              fieldNumber: p.fieldNumber,
              raw: p.raw,
            }))}
            emptyMessage="Nenhuma mensagem reconhecida."
          />
        </section>
      )}
    </main>
  );
}
