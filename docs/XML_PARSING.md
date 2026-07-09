# XML Parsing

## Entry points

- `detectDocumentType(parsed, rawXml)` → `NFE | NFCE | CTE | NFSE | EVENT | CANCELATION | CORRECTION_LETTER | UNKNOWN`
- `parseXmlDocument({ xml, fileName, batchId, workspaceId })`
- `flattenXmlObject(obj)` → path/value fields
- Extractors in `src/lib/parser/extract.ts`

## Guarantees

- Namespaces stripped for key detection  
- Arrays preserved in flatten paths (`det[0].prod.xProd`)  
- Invalid XML does not abort the whole batch — error recorded per file  
- `xmlHash` (SHA-256) attached during import for incremental/dedup  

## Classification

After extract, `classifyOperation` (`src/lib/fiscal/cfop.ts`) sets:

- `operationClassification`
- `operationConfidence`
- `cfopMain` / `natureOperation`

## Samples

Use only `samples/anonymized/*.xml` in CI. Real ZIPs stay in `private-imports/` / `private-test-data/`.
