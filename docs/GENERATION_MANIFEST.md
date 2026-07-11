# Generation Manifest

**Schema:** `1.0.0`  
**Module:** `src/lib/export/manifest.ts`

Every analytical export (JSON envelope, CSV comments, XLSX “Manifesto” sheet, HTML footer) should carry a `generationId` and metadata:

- app/commit version  
- workspace / batch ids  
- record counts  
- `emptyReason` when applicable (`all_documents_reused`, `no_documents_in_batch`, …)  
- honest disclaimer (not PVA-official / not tax assessment)

JSON uses `wrapExportEnvelope` — never bare `[]` as the only payload.
