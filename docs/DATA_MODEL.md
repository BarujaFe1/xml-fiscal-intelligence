# Data Model

## MVP store

Each batch is a JSON document `data/batches/{batchId}.json`:

- `batch` — metadata + quality report
- `documents[]` — friendly summary + `rawJson` + `flattenedJson`
- `items[]` — NFe dets / CTe linked docs / NFSe service details
- `fields[]` — key-value flattened tags
- `errors[]` — parse / zip issues
- `exports[]` — reserved for future stored artifacts

Raw XML files: `data/batches/{batchId}/xml/*`

## Production schema

See `supabase/schema.sql`:

- `profiles`, `workspaces`, `workspace_members`
- `batches`, `documents`, `document_items`, `document_fields`
- `parse_errors`, `exports`
- RLS via `is_workspace_member(workspace_id)`

## Flatten paths

Examples:

- `nfeProc.NFe.infNFe.ide.nNF`
- `nfeProc.NFe.infNFe.det[0].prod.xProd`
- `cteProc.CTe.infCte.vPrest.vTPrest`
- `CompNfse.Nfse.InfNfse.ValoresNfse.ValorLiquidoNfse`

Normalized paths strip namespaces for friendlier search while `pathOriginal` is preserved.
