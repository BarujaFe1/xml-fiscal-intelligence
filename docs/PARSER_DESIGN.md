# Parser Design

## Pipeline

1. `extractXmlFromZip` — safe ZIP walk  
2. `parseXmlDocument` — `fast-xml-parser`  
3. `detectDocumentType` — root/tags/heuristics → `NFE | CTE | NFSE | UNKNOWN`  
4. `flattenXmlObject` — every leaf becomes a field  
5. `extract*Summary` / `extract*Items` — friendly columns  
6. `calculateBatchQuality` — health score + alerts  

## Detection signals

- **NFE**: `nfeProc`, `infNFe`, `protNFe`, `det`  
- **CTE**: `cteProc`, `infCte`, `vPrest`, `infCarga`  
- **NFSE**: `CompNfse`, `InfNfse`, `PrestadorServico`, ABRASF-like names  

## Resilience

- Malformed XML → document `parseStatus=error`, batch continues  
- Unknown structure → `UNKNOWN` + error entry  
- NFSe municipal variance → best-effort deep find by tag names  

## Security

- `processEntities: false` (XXE mitigation)  
- No DTD expansion workflow  
- Size caps per XML and per ZIP file count  
