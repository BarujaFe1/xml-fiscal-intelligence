"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BatchStore } from "@/types";
import type { DocFilterState } from "@/lib/analytics";
import {
  previewExportPreflight,
  runSelectionExport,
  type SelectionExportFormat,
  type SelectionExportProgress,
} from "@/lib/export/selection-export";
import type {
  ExportCsvProfile,
  ExportJsonProfile,
  ExportPreflight,
  ExportPrivacyProfile,
} from "@/lib/export/v2/types";
import type { PackageArtifact } from "@/lib/export/v2/package";
import { idbGetRawXmlsForDocuments, type RawXmlRecord } from "@/lib/store/raw-xml-store";
import { snapshotSelectionIds } from "@/lib/documents/selection";

type WizardStep = "scope" | "format" | "options" | "review" | "generate";

const FORMATS: Array<{
  id: SelectionExportFormat;
  title: string;
  bestFor: string;
  content: string;
  sensitivity: string;
}> = [
  {
    id: "package",
    title: "Pacote completo",
    bestFor: "Auditoria e arquivamento em um único ZIP atômico",
    content: "Excel + CSV + JSON + HTML + TXT (+ XML opcional)",
    sensitivity: "Segue a política escolhida; XML exige operacional completo",
  },
  {
    id: "xlsx",
    title: "Excel (.xlsx)",
    bestFor: "Análise humana e planilhas operacionais",
    content: "Resumo, Documentos, Itens, Alertas, Manifesto",
    sensitivity: "Conforme política de privacidade",
  },
  {
    id: "csv-zip",
    title: "Pacote CSV",
    bestFor: "Power Query, pandas e integração",
    content: "documentos.csv + itens.csv + manifesto + SHA256 (DEFLATE)",
    sensitivity: "Conforme política; cabeçalho na 1ª linha",
  },
  {
    id: "csv-docs",
    title: "CSV de documentos",
    bestFor: "Importação rápida de cabeçalhos",
    content: "Uma linha por documento",
    sensitivity: "Conforme política",
  },
  {
    id: "csv-items",
    title: "CSV de itens",
    bestFor: "Análise de linhas de produto",
    content: "Uma linha por item",
    sensitivity: "Conforme política",
  },
  {
    id: "xml-zip",
    title: "ZIP de XMLs originais",
    bestFor: "Preservar bytes oficiais",
    content: "XMLs locais + manifesto",
    sensitivity: "Sempre operacional completo (XML não anonimiza)",
  },
  {
    id: "json",
    title: "JSON compacto",
    bestFor: "Integração e APIs",
    content: "Campos normalizados (sem rawJson/flattenedJson)",
    sensitivity: "Conforme política",
  },
  {
    id: "jsonl",
    title: "JSONL (NDJSON)",
    bestFor: "Lotes grandes / streaming",
    content: "Um documento por linha",
    sensitivity: "Conforme política",
  },
  {
    id: "json-flat",
    title: "JSON achatado",
    bestFor: "Campos flatten com prefixo _xfi.*",
    content: "Opt-in; maior tamanho",
    sensitivity: "Conforme política + estruturas achatadas",
  },
  {
    id: "html",
    title: "Relatório HTML",
    bestFor: "Leitura e impressão",
    content: "Autocontido; declara limite se truncar",
    sensitivity: "Conforme política",
  },
  {
    id: "keys-txt",
    title: "TXT de chaves",
    bestFor: "Sistemas externos (44 dígitos/linha)",
    content: "Somente chaves; sem cabeçalho",
    sensitivity: "Exige operacional completo",
  },
];

const STEP_LABEL: Record<SelectionExportProgress, string> = {
  preparing: "Preparando seleção…",
  preflight: "Pré-voo…",
  reading_xml: "Lendo XMLs locais…",
  building: "Montando arquivo…",
  downloading: "Finalizando download…",
  done: "Concluído",
  canceled: "Cancelado",
  error: "Erro",
};

const WIZARD_STEPS: WizardStep[] = ["scope", "format", "options", "review", "generate"];

function formatBytes(n?: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentExportModal({
  open,
  onClose,
  store,
  selectedIds,
  filters,
  xmlAvailableCount,
  xmlMissingCount,
}: {
  open: boolean;
  onClose: () => void;
  store: BatchStore;
  selectedIds: ReadonlySet<string>;
  filters: DocFilterState;
  xmlAvailableCount: number;
  xmlMissingCount: number;
}) {
  const [wizard, setWizard] = useState<WizardStep>("scope");
  const [format, setFormat] = useState<SelectionExportFormat>("package");
  const [privacy, setPrivacy] = useState<ExportPrivacyProfile>("operational_full");
  const [csvProfile, setCsvProfile] = useState<ExportCsvProfile>("excel_pt_br");
  const [jsonProfile, setJsonProfile] = useState<ExportJsonProfile>("compact");
  const [packageArtifacts, setPackageArtifacts] = useState<PackageArtifact[]>([
    "xlsx",
    "csv",
    "json",
    "html",
    "keys",
  ]);
  const [competenceAck, setCompetenceAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<SelectionExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partialXmlConfirm, setPartialXmlConfirm] = useState(false);
  const [lastHashNote, setLastHashNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lockedRef = useRef(false);

  const snapshot = useMemo(() => snapshotSelectionIds(selectedIds), [selectedIds]);

  const preflight: ExportPreflight | null = useMemo(() => {
    if (!open || !snapshot.length) return null;
    try {
      return previewExportPreflight(store, snapshot, {
        filters: { ...filters },
        privacyProfile: privacy,
        rawXmlAvailability: snapshot.map((id) => ({
          documentId: id,
          available: true, // optimistic for estimate; real check on generate for XML
        })),
      });
    } catch {
      return null;
    }
  }, [open, store, snapshot, filters, privacy]);

  // Adjust XML availability estimate from props
  const preflightView = useMemo(() => {
    if (!preflight) return null;
    return {
      ...preflight,
      xmlAvailable: xmlAvailableCount,
      xmlMissing: xmlMissingCount,
      estimatedBytes: preflight.estimatedBytes,
    };
  }, [preflight, xmlAvailableCount, xmlMissingCount]);

  function resetModalState() {
    setBusy(false);
    setStep(null);
    setError(null);
    setPartialXmlConfirm(false);
    setCompetenceAck(false);
    setLastHashNote(null);
    setWizard("scope");
    abortRef.current?.abort();
    abortRef.current = null;
    lockedRef.current = false;
  }

  function handleClose() {
    resetModalState();
    onClose();
  }

  function goNext() {
    const i = WIZARD_STEPS.indexOf(wizard);
    if (i < WIZARD_STEPS.length - 1) setWizard(WIZARD_STEPS[i + 1]!);
  }

  function goBack() {
    const i = WIZARD_STEPS.indexOf(wizard);
    if (i > 0) setWizard(WIZARD_STEPS[i - 1]!);
  }

  function toggleArtifact(a: PackageArtifact) {
    setPackageArtifacts((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }

  if (!open) return null;

  async function handleGenerate(allowPartialXml = false) {
    if (lockedRef.current || !snapshot.length) return;
    lockedRef.current = true;
    setBusy(true);
    setError(null);
    setWizard("generate");
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      let rawByDocumentId = new Map<string, RawXmlRecord>();
      const needsXml =
        format === "xml-zip" || (format === "package" && packageArtifacts.includes("xml"));

      if (needsXml) {
        setStep("reading_xml");
        rawByDocumentId = await idbGetRawXmlsForDocuments(store.batch.id, snapshot);
        if (rawByDocumentId.size === 0) {
          setError(
            "XML original indisponível; reimporte o ZIP. Lotes antigos não possuem rawXml no IndexedDB.",
          );
          return;
        }
        if (rawByDocumentId.size < snapshot.length && !allowPartialXml && !partialXmlConfirm) {
          setPartialXmlConfirm(true);
          setError(
            `${snapshot.length - rawByDocumentId.size} documento(s) sem XML original. Confirme para exportar apenas os ${rawByDocumentId.size} disponíveis.`,
          );
          return;
        }
      }

      const result = await runSelectionExport({
        store,
        selectedIds: snapshot,
        format,
        filters: { ...filters },
        rawByDocumentId,
        organizeXmlByType: true,
        allowPartialXml: allowPartialXml || partialXmlConfirm,
        privacyProfile: privacy,
        csvProfile,
        jsonProfile,
        packageArtifacts,
        competenceAcknowledged: competenceAck,
        signal: ac.signal,
        onProgress: (s, detail) => {
          setStep(s);
          if (detail) setLastHashNote(detail);
        },
      });

      if (!result.ok) {
        setError(result.message || "Falha na exportação");
        if (result.requiresCompetenceAck) {
          setWizard("review");
        }
        if (result.missingXmlIds?.length && needsXml) {
          setPartialXmlConfirm(true);
        }
        return;
      }

      toast.success(`Download: ${result.filename}`);
      if (result.generationId) {
        setLastHashNote(`Geração ${result.generationId}`);
      }
      if (result.withoutKey) {
        toast.message(`${result.withoutKey} documento(s) sem chave ignorados`);
      }
      if (result.missingIds?.length) {
        setError(`${result.missingIds.length} ID(s) inexistentes ignorados.`);
      } else {
        handleClose();
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStep("canceled");
        return;
      }
      setError(err instanceof Error ? err.message : "Falha na exportação");
      setStep("error");
    } finally {
      lockedRef.current = false;
      setBusy(false);
      abortRef.current = null;
    }
  }

  const selectedFormat = FORMATS.find((f) => f.id === format);
  const xmlForced =
    format === "xml-zip" ||
    format === "keys-txt" ||
    (format === "package" && packageArtifacts.includes("xml"));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 id="export-modal-title" className="text-lg font-semibold text-slate-50">
              Central de exportação
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {snapshot.length} documento(s) · passo{" "}
              {WIZARD_STEPS.indexOf(wizard) + 1}/{WIZARD_STEPS.length}:{" "}
              {{
                scope: "Escopo",
                format: "Formato",
                options: "Privacidade",
                review: "Revisão",
                generate: "Geração",
              }[wizard]}
            </p>
          </div>
          <Button size="sm" variant="ghost" aria-label="Fechar" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {wizard === "scope" && (
            <Card className="border-white/10 bg-slate-900/40">
              <CardHeader>
                <CardTitle className="text-base">Escopo</CardTitle>
                <CardDescription>
                  Exportação baseada na seleção atual (IDs estáveis). Alterar filtros depois não muda
                  este snapshot.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-300">
                <p>
                  Documentos selecionados: <strong>{snapshot.length}</strong>
                </p>
                <p>
                  XML local disponível: {xmlAvailableCount} · indisponível: {xmlMissingCount}
                </p>
                <p className="text-xs text-slate-500">
                  Lote: {store.batch.name}
                  {store.batch.month && store.batch.year
                    ? ` · competência informada ${String(store.batch.month).padStart(2, "0")}/${store.batch.year}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          )}

          {wizard === "format" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {FORMATS.map((f) => {
                const xmlBlocked = f.id === "xml-zip" && xmlAvailableCount === 0;
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={xmlBlocked}
                    onClick={() => setFormat(f.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-sky-400/50 bg-sky-500/10"
                        : "border-white/10 bg-slate-900/40 hover:border-white/20"
                    } ${xmlBlocked ? "opacity-50" : ""}`}
                  >
                    <div className="font-medium text-slate-50">{f.title}</div>
                    <div className="mt-1 text-xs text-slate-400">Melhor uso: {f.bestFor}</div>
                    <div className="mt-1 text-xs text-slate-500">Conteúdo: {f.content}</div>
                    <div className="mt-1 text-xs text-amber-200/80">Sensibilidade: {f.sensitivity}</div>
                    {xmlBlocked && (
                      <div className="mt-1 text-xs text-rose-300">XML indisponível neste lote</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {wizard === "options" && (
            <div className="space-y-4">
              <Card className="border-white/10 bg-slate-900/40">
                <CardHeader>
                  <CardTitle className="text-base">Privacidade</CardTitle>
                  <CardDescription>
                    A mesma política vale para todos os formatos desta geração.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(
                    [
                      ["operational_full", "Operacional completo — chave e documentos integrais"],
                      ["shareable_masked", "Compartilhável mascarado — chaves e docs mascarados"],
                      ["custom", "Customizado (defaults seguros = mascarado)"],
                    ] as const
                  ).map(([id, label]) => (
                    <label key={id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="privacy"
                        checked={privacy === id}
                        disabled={xmlForced && id !== "operational_full"}
                        onChange={() => setPrivacy(id)}
                      />
                      <span className="text-slate-300">{label}</span>
                    </label>
                  ))}
                  {xmlForced && (
                    <p className="text-xs text-amber-200" role="status">
                      Este formato exige perfil operacional completo. Mascarar o nome do arquivo não
                      anonimiza o conteúdo XML; TXT de chaves precisa de 44 dígitos.
                    </p>
                  )}
                </CardContent>
              </Card>

              {(format === "csv-docs" || format === "csv-items" || format === "csv-zip" || format === "package") && (
                <Card className="border-white/10 bg-slate-900/40">
                  <CardHeader>
                    <CardTitle className="text-base">Perfil CSV</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <label className="flex gap-2">
                      <input
                        type="radio"
                        checked={csvProfile === "excel_pt_br"}
                        onChange={() => setCsvProfile("excel_pt_br")}
                      />
                      Excel PT-BR (BOM, ; , CRLF)
                    </label>
                    <label className="flex gap-2">
                      <input
                        type="radio"
                        checked={csvProfile === "integration"}
                        onChange={() => setCsvProfile("integration")}
                      />
                      Integração (UTF-8, vírgula, decimais com ponto)
                    </label>
                  </CardContent>
                </Card>
              )}

              {(format === "json" || format === "package") && (
                <Card className="border-white/10 bg-slate-900/40">
                  <CardHeader>
                    <CardTitle className="text-base">Perfil JSON</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <label className="flex gap-2">
                      <input
                        type="radio"
                        checked={jsonProfile === "compact"}
                        onChange={() => setJsonProfile("compact")}
                      />
                      Compacto (padrão)
                    </label>
                    <label className="flex gap-2">
                      <input
                        type="radio"
                        checked={jsonProfile === "audit_full"}
                        onChange={() => setJsonProfile("audit_full")}
                      />
                      Auditoria completa (maior e mais sensível)
                    </label>
                  </CardContent>
                </Card>
              )}

              {format === "package" && (
                <Card className="border-white/10 bg-slate-900/40">
                  <CardHeader>
                    <CardTitle className="text-base">Artefatos do pacote</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    {(
                      [
                        ["xlsx", "Excel"],
                        ["csv", "CSV"],
                        ["json", "JSON"],
                        ["html", "HTML"],
                        ["keys", "TXT chaves"],
                        ["xml", "XMLs originais"],
                      ] as const
                    ).map(([id, label]) => (
                      <label key={id} className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={packageArtifacts.includes(id)}
                          onChange={() => toggleArtifact(id)}
                        />
                        {label}
                      </label>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {wizard === "review" && preflightView && (
            <div className="space-y-3">
              <Card className="border-white/10 bg-slate-900/40">
                <CardHeader>
                  <CardTitle className="text-base">Pré-voo</CardTitle>
                  <CardDescription>
                    {selectedFormat?.title} · {privacy}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>Solicitados: {preflightView.requested}</p>
                  <p>Encontrados: {preflightView.found}</p>
                  <p>IDs ausentes: {preflightView.missingIds}</p>
                  <p>
                    XML: {preflightView.xmlAvailable} ok / {preflightView.xmlMissing} ausentes
                  </p>
                  <p>Erros de parse: {preflightView.parseErrorCount}</p>
                  <p>Duplicados: {preflightView.duplicateCount}</p>
                  <p>Fora da competência: {preflightView.outsideCompetenceCount}</p>
                  <p>Total: R$ {preflightView.totalValue}</p>
                  <p>
                    Competência: {preflightView.informedCompetence || "—"}
                  </p>
                  <p>
                    Período real: {preflightView.realPeriodMin || "—"} →{" "}
                    {preflightView.realPeriodMax || "—"}
                  </p>
                  <p className="sm:col-span-2">
                    Tamanho estimado ({format}):{" "}
                    {formatBytes(preflightView.estimatedBytes[format])}
                  </p>
                </CardContent>
              </Card>

              {preflightView.requiresCompetenceAck && (
                <div
                  className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-3 text-sm text-amber-50"
                  role="alert"
                >
                  <p className="font-medium">Divergência de competência</p>
                  <p className="mt-1 text-amber-100/90">
                    A competência informada no lote não coincide com as datas reais dos documentos.
                    A competência <strong>não</strong> será alterada automaticamente.
                  </p>
                  <label className="mt-3 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={competenceAck}
                      onChange={(e) => setCompetenceAck(e.target.checked)}
                    />
                    <span>Li o aviso e desejo continuar a exportação mesmo assim.</span>
                  </label>
                </div>
              )}

              {preflightView.warnings
                .filter((w) => !w.includes("diverge"))
                .map((w) => (
                  <p key={w} className="text-xs text-slate-400">
                    • {w}
                  </p>
                ))}
            </div>
          )}

          {wizard === "generate" && (
            <div className="space-y-3">
              {busy && step && (
                <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {STEP_LABEL[step]}
                  {lastHashNote ? ` · ${lastHashNote}` : ""}
                </div>
              )}
              {!busy && !error && (
                <p className="text-sm text-slate-400">Pronto para gerar o arquivo.</p>
              )}
            </div>
          )}

          {error && (
            <div
              className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
              role="alert"
            >
              {error}
              {partialXmlConfirm && (
                <div className="mt-2">
                  <Button size="sm" disabled={busy} onClick={() => handleGenerate(true)}>
                    Exportar apenas XMLs disponíveis
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
            <div className="flex gap-2">
              {wizard !== "scope" && (
                <Button size="sm" variant="outline" disabled={busy} onClick={goBack}>
                  Voltar
                </Button>
              )}
              {busy && (
                <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}>
                  Cancelar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {wizard !== "generate" && wizard !== "review" && (
                <Button size="sm" onClick={goNext} disabled={!snapshot.length}>
                  Continuar
                </Button>
              )}
              {wizard === "review" && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (preflightView?.requiresCompetenceAck && !competenceAck) {
                      setError("Confirme o aviso de competência para continuar.");
                      return;
                    }
                    void handleGenerate();
                  }}
                  disabled={busy || !snapshot.length}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Gerar e baixar
                </Button>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Exportação analítica interna. Não constitui apuração oficial. Um único download por
            geração — sem múltiplos arquivos paralelos.
          </p>
        </div>
      </div>
    </div>
  );
}
