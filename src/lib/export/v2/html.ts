import type { ExportDatasetV2 } from "@/lib/export/v2/types";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoneyPt(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return esc(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDatePt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString("pt-BR");
}

const DEFAULT_TABLE_LIMIT = 500;

/**
 * Self-contained HTML report. No external resources.
 * When documents exceed `tableLimit`, shows an unambiguous truncation notice.
 */
export function buildHtmlFromDataset(
  dataset: ExportDatasetV2,
  options?: { tableLimit?: number },
): string {
  const limit = options?.tableLimit ?? DEFAULT_TABLE_LIMIT;
  const { summary, documents, findings, privacy, manifest } = dataset;
  const shown = documents.slice(0, limit);
  const omitted = Math.max(0, documents.length - shown.length);
  const limitNotice =
    omitted > 0
      ? `<div class="limit" role="status">Exibindo ${shown.length} de ${documents.length}; ${omitted} não aparecem nesta tabela. Use o Excel/CSV/JSON completo para a seleção integral.</div>`
      : `<div class="ok" role="status">Exibindo todos os ${documents.length} documento(s) selecionado(s).</div>`;

  const typeRows = Object.entries(summary.byType)
    .map(([t, n]) => `<tr><td>${esc(t)}</td><td>${n}</td></tr>`)
    .join("");

  const alertRows = findings
    .slice(0, 100)
    .map(
      (f) =>
        `<tr><td>${esc(f.severity)}</td><td>${esc(f.code)}</td><td>${esc(f.title)}</td><td>${esc(f.documentId || "")}</td></tr>`,
    )
    .join("");

  const docRows = shown
    .map(
      (d) => `<tr>
      <td>${esc(d.documentType)}</td>
      <td>${esc(d.number || "")}</td>
      <td>${formatDatePt(d.issueDate)}</td>
      <td>${esc(d.emitterName || d.emitterDoc || "")}</td>
      <td>${esc(d.receiverName || d.receiverDoc || "")}</td>
      <td>${esc(d.status || d.parseStatus)}</td>
      <td class="num">${formatMoneyPt(d.totalValue)}</td>
      <td>${esc(d.accessKey || "")}</td>
    </tr>`,
    )
    .join("");

  const competenceWarn = summary.competenceMismatch
    ? `<div class="warn" role="alert"><strong>Atenção:</strong> competência informada (${esc(summary.informedCompetence)}) diverge do período real (${esc(summary.realPeriodMin)} a ${esc(summary.realPeriodMax)}). ${summary.outsideCompetenceCount} documento(s) fora da competência.</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Relatório — ${esc(summary.batchName)}</title>
<style>
  :root { --ink:#1a2332; --muted:#5a6577; --line:#d8dee8; --bg:#f7f9fc; --warn:#7a4a00; --warnbg:#fff4e0; --ok:#0f5c38; --okbg:#e8f7ef; --lim:#1e3a5f; --limbg:#e8f0fa; }
  * { box-sizing: border-box; }
  body { margin:0; font: 14px/1.45 "Segoe UI", system-ui, sans-serif; color:var(--ink); background:var(--bg); }
  header { padding: 1.25rem 1.5rem; background:#fff; border-bottom:1px solid var(--line); }
  h1 { margin:0 0 .35rem; font-size:1.35rem; }
  .meta { color:var(--muted); font-size:.9rem; }
  main { padding: 1.25rem 1.5rem 3rem; max-width: 1200px; margin:0 auto; }
  .kpis { display:grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap:.75rem; margin:1rem 0; }
  .kpi { background:#fff; border:1px solid var(--line); padding:.75rem .9rem; }
  .kpi b { display:block; font-size:1.25rem; }
  .kpi span { color:var(--muted); font-size:.8rem; }
  .warn { background:var(--warnbg); color:var(--warn); border:1px solid #f0d9a8; padding:.75rem 1rem; margin:1rem 0; }
  .ok { background:var(--okbg); color:var(--ok); border:1px solid #b7e0c8; padding:.6rem .9rem; margin:1rem 0; }
  .limit { background:var(--limbg); color:var(--lim); border:1px solid #b8cce4; padding:.6rem .9rem; margin:1rem 0; }
  table { width:100%; border-collapse:collapse; background:#fff; margin: .75rem 0 1.5rem; }
  th, td { border:1px solid var(--line); padding:.4rem .55rem; text-align:left; vertical-align:top; }
  th { background:#eef2f7; font-size:.8rem; }
  .num { text-align:right; white-space:nowrap; }
  .toolbar { display:flex; gap:.5rem; flex-wrap:wrap; margin:.5rem 0 1rem; }
  input[type=search] { flex:1; min-width:200px; padding:.45rem .6rem; border:1px solid var(--line); }
  footer { color:var(--muted); font-size:.8rem; margin-top:2rem; border-top:1px solid var(--line); padding-top:1rem; }
  @media print {
    body { background:#fff; }
    header { border:none; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    .toolbar { display:none; }
  }
</style>
</head>
<body>
<header>
  <h1>${esc(summary.batchName)}</h1>
  <p class="meta">Gerado em ${esc(manifest.generatedAt)} (${esc(manifest.timezone)}) · Política: ${esc(privacy.profile)} · Geração ${esc(manifest.generationId)}</p>
</header>
<main>
  ${competenceWarn}
  <div class="kpis">
    <div class="kpi"><b>${summary.documentCount}</b><span>Documentos</span></div>
    <div class="kpi"><b>${summary.itemCount}</b><span>Itens</span></div>
    <div class="kpi"><b>${formatMoneyPt(summary.totalValue)}</b><span>Valor total</span></div>
    <div class="kpi"><b>${summary.healthScore ?? "—"}</b><span>Índice de qualidade</span></div>
    <div class="kpi"><b>${summary.findingCount}</b><span>Alertas</span></div>
    <div class="kpi"><b>${summary.xmlAvailableCount}/${summary.documentCount}</b><span>XMLs disponíveis</span></div>
  </div>
  <p class="meta">Competência informada: <strong>${esc(summary.informedCompetence || "não informada")}</strong> · Período real: <strong>${esc(summary.realPeriodMin || "—")} → ${esc(summary.realPeriodMax || "—")}</strong></p>
  <p class="meta">${esc(privacy.note)}</p>

  <h2>Composição por tipo</h2>
  <table><thead><tr><th>Tipo</th><th>Qtd</th></tr></thead><tbody>${typeRows || "<tr><td colspan=2>Sem dados</td></tr>"}</tbody></table>

  <h2>Alertas (até 100)</h2>
  <table><thead><tr><th>Severidade</th><th>Código</th><th>Título</th><th>Documento</th></tr></thead><tbody>${alertRows || "<tr><td colspan=4>Nenhum alerta nesta seleção</td></tr>"}</tbody></table>

  <h2>Documentos</h2>
  ${limitNotice}
  <div class="toolbar">
    <input type="search" id="q" placeholder="Buscar na tabela…" aria-label="Buscar documentos"/>
  </div>
  <table id="docs">
    <thead>
      <tr>
        <th>Tipo</th><th>Número</th><th>Emissão</th><th>Emitente</th><th>Destinatário</th><th>Status</th><th>Valor</th><th>Chave</th>
      </tr>
    </thead>
    <tbody>${docRows || "<tr><td colspan=8>Nenhum documento</td></tr>"}</tbody>
  </table>

  <footer>
    <p>${esc(manifest.disclaimer)}</p>
    <p>Filtros: ${esc(JSON.stringify(manifest.filters))}</p>
  </footer>
</main>
<script>
(function(){
  var input = document.getElementById('q');
  var table = document.getElementById('docs');
  if (!input || !table) return;
  input.addEventListener('input', function(){
    var q = (input.value || '').toLowerCase();
    var rows = table.tBodies[0] ? table.tBodies[0].rows : [];
    for (var i = 0; i < rows.length; i++) {
      var t = (rows[i].textContent || '').toLowerCase();
      rows[i].style.display = !q || t.indexOf(q) >= 0 ? '' : 'none';
    }
  });
})();
</script>
</body>
</html>`;
}
