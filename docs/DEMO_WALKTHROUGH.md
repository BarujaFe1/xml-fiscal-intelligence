# Demo walkthrough (3–5 minutos)

Ambiente: `npm run dev` ou https://xml-fiscal-intelligence.vercel.app  
Dados: ZIP de `samples/anonymized` (sem PII real).

## Roteiro

### 1. Problema (30s)

“Todo mês chega um ZIP de XML fiscal. Quero dataset pesquisável, exportável e auditável — sem fingir que sou o PVA.”

### 2. Upload → lote (60–90s)

1. Abrir **Upload**  
2. Enviar `samples.zip` (ou lote IndexedDB já existente)  
3. Mostrar progresso, tipos detectados (NF-e/CT-e/NFS-e), quality score  

### 3. Normalização + busca (60s)

1. Abrir o lote → documentos / itens  
2. Buscar por NCM, CFOP ou razão social  
3. Abrir um documento: flatten de tags + itens  

### 4. Export / auditoria (45s)

1. Export Excel/CSV  
2. Aba Auditoria: findings heurísticos (falsos positivos esperados)  

### 5. Obrigações com honestidade (60s)

1. **Obrigações → EFD ICMS/IPI**  
2. **Preencher demo** *ou* lote real + **Usar emitente do lote**  
3. Gerar TXT → explicar: rascunho para PVA, não transmissão  

### 6. Fechamento (20s)

Citar limites: IndexedDB, NFS-e best-effort, sem scrap SEFAZ, AI mock off.

## O que *não* dizer

- “SPED válido / pronto para transmissão”  
- “Enterprise production / IA fiscal” sem evidência  
- “Substitui o contador / PVA”  
