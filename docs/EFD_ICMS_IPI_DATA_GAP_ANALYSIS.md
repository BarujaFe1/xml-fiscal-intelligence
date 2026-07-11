# EFD ICMS/IPI — Data Gap Analysis

> Maps what the current XML parser / BatchStore already provides versus what EFD ICMS/IPI records need.  
> Sources of truth for field extraction: `src/lib/parser/extract.ts`, `src/types/index.ts`, `src/lib/store/process-memory.ts`.  
> SPED preview (`src/modules/sped/preview.ts`) does **not** generate records — it only flags readiness heuristically.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Available as typed field today |
| 🟡 | Present in XML / `taxJson` / `flattenedJson` / `rawJson` but **not normalized** |
| 🟠 | Derivable with deterministic rule (needs implementation + test) |
| ❌ | Not obtainable from XML alone — needs cadastro / import / manual / prior period |
| 🚫 | Must not invent / not applicable without explicit rule |

---

## 1. Company & period context (blocks generation)

| Need | Status | Notes |
|------|--------|-------|
| CNPJ estabelecimento | ❌ / weak | Only optional `batch.cnpjLabel` |
| IE | ❌ | |
| UF / município IBGE (`COD_MUN`) | ❌ | City name only on parties |
| Razão social | ❌ | |
| Período DT_INI / DT_FIN | 🟠 | Batch month/year loose |
| Finalidade do arquivo | ❌ | |
| Perfil A/B/C | ❌ | Must not presume |
| IND_ATIV (atividade) | ❌ | Must not presume |
| Contabilista (0100) | ❌ | |
| COD_VER / layout version | ❌ | Must resolve from period + registry |
| Regime tributário | ❌ | Must not presume |

**Conclusion:** Generation must be blocked until establishment + tax profile + period + layout version are complete.

---

## 2. Bloco 0

### 0000 — Abertura

| Field group | Status |
|-------------|--------|
| Identificação contribuinte | ❌ |
| Período / finalidade / perfil / atividade | ❌ |
| Hash / versioning of generation | ❌ (to build) |

### 0150 — Participantes

| Field | Status |
|-------|--------|
| CNPJ/CPF | ✅ `emitterDoc` / `receiverDoc` |
| Nome | ✅ |
| UF / xMun | ✅ names only |
| IE | ❌ |
| COD_MUN (IBGE) | ❌ |
| Endereço (logradouro, nro, bairro, CEP) | 🟡 in XML `enderEmit`/`enderDest` if raw kept |
| COD_PAIS / SUFRAMA | 🟡 / ❌ |
| COD_PART stable key | 🟠 derive from doc |

### 0190 — Unidades

| Field | Status |
|-------|--------|
| UNID from items | ✅ `unit` |
| Description of unit | ❌ |

### 0200 — Itens

| Field | Status |
|-------|--------|
| COD_ITEM / DESCR_ITEM | ✅ `code` / `description` |
| COD_NCM | ✅ `ncm` |
| UNID_INV | ✅ `unit` |
| COD_BARRA / CEST | 🟡 / type exists unused |
| TIPO_ITEM | ❌ / 🚫 do not invent from NCM alone |
| COD_GEN / EX_IPI / COD_LST / ALIQ_ICMS | ❌ / 🟡 |

### 0400 — Natureza da operação

| Field | Status |
|-------|--------|
| natOp text | ✅ `natureOperation` |
| COD_NAT registry | ❌ |

### 0450 / 0500 / 0600

| Record | Status |
|--------|--------|
| Info complementar / contas / centros | ❌ |

---

## 3. Bloco C (NF-e / NFC-e)

### C100 — Documento

| Field | Status |
|-------|--------|
| CHV_NFE | ✅ `accessKey` |
| NUM_DOC / SER / COD_MOD | ✅ |
| DT_DOC / DT_E_S | ✅ / 🟠 |
| VL_DOC / VL_MERC / VL_FRT / VL_DESC | ✅ |
| IND_OPER (entrada/saída) | 🟠 from CFOP digit / emit vs establishment |
| IND_EMIT | 🟠 vs establishment CNPJ |
| COD_PART | 🟠 |
| COD_SIT | 🟠 from events/cancel + cStat |
| VL_BC_ICMS / VL_ICMS / VL_BC_ICMS_ST / VL_ICMS_ST | 🟡 in `ICMSTot` |
| VL_IPI / VL_PIS / VL_COFINS | 🟡 (partially summed into `taxValue`) |
| IND_FRT / VL_SEG / VL_OUT_DA / VL_ABAT_NT | 🟡 |
| Protocol / auth | ✅ |

### C170 — Itens

| Field | Status |
|-------|--------|
| NUM_ITEM / COD_ITEM / QTD / UNID / VL_ITEM / VL_DESC | ✅ |
| CFOP | ✅ |
| NCM | ✅ (0200 link) |
| CST_ICMS / orig | 🟡 in `taxJson` |
| VL_BC_ICMS / ALIQ_ICMS / VL_ICMS | 🟡 |
| ST / FCP / IPI / PIS / COFINS structured | 🟡 |
| IND_MOV / COD_NAT / COD_CTA / IND_APUR | ❌ |
| CSOSN | 🟡 / type unused |

**Blocker:** Without a deterministic `normalizeNFeTax(imposto)` producing CST/BC/alíq/valores, C170/C190 must not be emitted as “complete”.

### C190 — Analítico

| Field | Status |
|-------|--------|
| Aggregation CST + CFOP + ALIQ | ❌ not implemented (preview lies as “derived”) |

### Other C* (C113, C120, C140, C160, C175, C177, …)

| Status |
|--------|
| ❌ / scenario-specific — mark unsupported until fixtures exist |

---

## 4. Bloco D (CT-e)

| Need | Status |
|------|--------|
| Header totals / CFOP / parties | ✅ partial via CTE summary |
| ICMS do CT-e | 🟡 in raw / not in items |
| D100 / D190 builders | ❌ |
| Linked NF-e keys | 🟠 relationships + CTE items |

---

## 5. Bloco E — Apuração

| Record | Status |
|--------|--------|
| E100 period | ❌ |
| E110 débitos/créditos/ajustes/saldo | ❌ |
| Saldo credor anterior | ❌ complementary import |
| Ajustes / códigos UF | ❌ |
| DIFAL / FCP / IPI assessment | ❌ |

**Rule:** Never compute E110 as “sum of XML ICMS” without explicit assessment model + tests + missing-data prompts.

---

## 6. Blocos B, G, H, K, 1, 9

| Block | Status | Note |
|-------|--------|------|
| B (ISS) | 🚫 for EFD ICMS/IPI default | NFS-e ≠ automatic Bloco B |
| G CIAP | ❌ | Needs fixed assets |
| H Inventário | ❌ | Needs inventory snapshot |
| K Produção | ❌ | Needs production orders |
| 1 Outros | ❌ | Selective later |
| 9 Contadores | 🟠 | After real records exist |

---

## 7. What XML alone can never supply

Must be collected via cadastro / CSV / API / prior file / accountant decision:

1. Perfil SPED e IND_ATIV  
2. IE e COD_MUN IBGE do estabelecimento  
3. Contabilista  
4. Saldo credor / obrigações a recolher anteriores  
5. Códigos de ajuste e benefícios estaduais  
6. Inventário, produção, CIAP  
7. Plano de contas / COD_CTA  
8. TIPO_ITEM quando não documentado  
9. Decisão de crédito / benefício  
10. Confirmação de documentos fora do ZIP (extemporâneos)

---

## 8. Recommended engineering order (data layer)

1. **Tax normalizer** for NF-e `imposto` → typed ICMS/IPI/PIS/COFINS (deterministic, tested)  
2. **Participant enricher** (IE, COD_MUN) with manual/CSV fallback  
3. **Product master** (0200) with TIPO_ITEM required input  
4. **C100/C170 builders** only when readiness = complete  
5. **C190 aggregator** from normalized lines  
6. **E110** only with assessment module + prior balances  
7. Keep storing raw XML for lineage (`Ver origem`)

---

## 9. Risk if we generate too early

- Silent wrong CST/alíquota from partial taxJson walks  
- C190 mismatch vs C170  
- E110 “fake” apuração → user trusts internal “OK”  
- Mixing 2025/2026 layout rules  

All are **unacceptable** under project principles. Prefer blocked readiness over incomplete TXT.
