# Exports

## Batch presets

Excel (multi-sheet), CSV, JSON, HTML via batch export UI (`/app/batches/[id]/exports`).

## Selection export hub (documents page)

On `/app/batches/[id]/documents`:

1. Filter documents (URL-synced).
2. Select individually or **all filtered results** (not only virtualized rows).
3. Open **Exportar selecionados**.

### Formats

| Format | File name pattern | Notes |
|--------|-------------------|--------|
| ZIP de XMLs | `xml-selecionados-{lote}-{data}.zip` | Original XML only — never reconstructed |
| Excel | `notas-selecionadas-{lote}-{data}.xlsx` | Resumo, Documentos, Itens, Alertas, Manifesto |
| CSV docs | `documentos-selecionados-{lote}-{data}.csv` | `;` separator, UTF-8 BOM |
| CSV items | `itens-selecionados-{lote}-{data}.csv` | Selected documents only |
| CSV package | `csv-selecionados-{lote}-{data}.zip` | Both CSVs + manifest |
| JSON | `dados-selecionados-{lote}-{data}.json` | Envelope; no raw XML by default |
| HTML | `relatorio-selecionado-{lote}-{data}.html` | Self-contained |
| TXT keys | `chaves-selecionadas-{lote}-{data}.txt` | One access key per line |

### Selection semantics

- Identity is always `documentId`.
- Changing filters does **not** clear selection; outside-filter count is shown.
- Export snapshots IDs at start.
- Missing IDs are ignored with a warning.

### Original XML policy

- During import, exact XML text is stored in IndexedDB object store `rawXml` (DB v2).
- Never stored in `localStorage`.
- Never uploaded to Supabase solely for this feature.
- Old batches without `rawXml`: UI shows “XML original indisponível; reimporte o ZIP”.
- Deleting a batch cascades to its `rawXml` rows.
- QuotaExceededError surfaces a clear message; the batch metadata may still be saved.

### Privacy

Exports are analytical only. They are not official SEFAZ/PVA output. Sensitive values follow existing redaction/sanitization helpers.
