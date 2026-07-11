# EFD ICMS/IPI — Support Matrix

> Status vocabulary for commercial honesty.  
> A cell may only be marked **Supported** when: automated test + fixture + versioned rule + known result (+ preferably PVA) exist.

## Status codes

| Code | Meaning | UI label |
|------|---------|----------|
| `NS` | Not started | Não disponível |
| `DIAG` | Diagnostic only | Diagnóstico |
| `PARTIAL` | Some fields/scenarios | Parcial — revisão obrigatória |
| `INTERNAL` | Internal validation only | Pré-validado internamente |
| `SUPPORTED` | Meets acceptance bar | Suportado (cenário X) |
| `PVA` | Confirmed with official PVA result | Validado no PVA (anexo) |
| `NA` | Not applicable | Não aplicável |

**Current product (2026-07-10):** almost everything is `NS` or `DIAG`. Preview UI must not display as Supported.

---

## 1. Platform prerequisites

| Capability | Status | Evidence |
|------------|--------|----------|
| XML NF-e ingest | PARTIAL→INTERNAL path exists | parser tests |
| XML CT-e ingest | PARTIAL | parser tests |
| XML NFS-e ingest | PARTIAL | parser — **not** EFD driver |
| Auth / RLS | NS | schema only |
| Establishments | NS | |
| Billing / entitlements | NS | |
| Async import + private storage | NS | IDB/FS only |
| Obligation plugin core | NS | |
| Versioned official rules | NS | |
| TXT serializer | NS | |
| Lineage | NS | |
| PVA report import | NS | |
| Transmission | NS | **out of scope v1** |

---

## 2. Layout versions

| Layout / guide | Period intent | Status | Notes |
|----------------|---------------|--------|-------|
| EFD ICMS/IPI (pre-2025 historical) | historical | NS | Needed for retificação later |
| Guia Prático ~3.2.2 (2026 watch) | 2026 | NS | Register official source before coding |
| Guia Prático ~3.2.3 (2027 announced) | 2027+ | NS | Do not mix with 2026 generations |
| State tables (per UF) | varies | NS | |

*Exact guide numbers must be confirmed from official downloads and stored in `official_sources` — never “latest” alone.*

---

## 3. Blocks & records (generation)

| Block / Record | Status now | Target MVP (Phase 5 proposal) | Blockers |
|----------------|------------|-------------------------------|----------|
| 0000 | DIAG | PARTIAL→INTERNAL | company/IE/perfil/period |
| 0100 | NS | PARTIAL | accountant cadastro |
| 0150 | DIAG | PARTIAL | IE, COD_MUN |
| 0190 | NS | PARTIAL | unit descriptions |
| 0200 | DIAG | PARTIAL | TIPO_ITEM |
| 0400 | NS | PARTIAL optional | COD_NAT |
| 0450/0500/0600 | NS | NS | |
| C100 (mod 55) | DIAG | PARTIAL→INTERNAL | tax totals split, IND_* |
| C170 | DIAG | PARTIAL→INTERNAL | tax normalizer |
| C190 | DIAG (false “derived”) | PARTIAL→INTERNAL | depends on C170 |
| Other C* | NS | NS | fixtures |
| D100/D190 | NS | PARTIAL if CT-e in scope | CTE tax normalize |
| E100/E110 | NS | PARTIAL only with balances | no silent sum |
| E111+ | NS | NS | |
| Bloco B | NA/NS | NA default | NFS-e ≠ auto |
| G/H/K | NS | NS (Phase 7) | |
| Bloco 1 | NS | NS | |
| 9900/9990/9999 | DIAG | INTERNAL with real counts | |

---

## 4. Scenario matrix (template for Phase 5+)

Fill rows only when fixtures exist.

| Obligation | Period | Layout | UF | Perfil | Scenario | PVA | Result |
|------------|--------|--------|----|--------|----------|-----|--------|
| EFD ICMS/IPI | TBD | TBD | TBD | TBD | NF-e saída 5102 simples | — | NS |
| EFD ICMS/IPI | TBD | TBD | TBD | TBD | NF-e entrada 1102 | — | NS |
| EFD ICMS/IPI | TBD | TBD | TBD | TBD | Cancelamento | — | NS |
| EFD ICMS/IPI | TBD | TBD | TBD | TBD | CT-e vinculado | — | NS |
| EFD ICMS/IPI | TBD | TBD | TBD | TBD | ST / FCP | — | NS |
| EFD ICMS/IPI | TBD | TBD | TBD | TBD | Extemporâneo | — | NS |

Owner must pick first UF + perfil for golden files before Phase 5 coding.

---

## 5. Validation levels

| Level | Name | Status |
|-------|------|--------|
| 1 | Structural (order, types, hierarchy) | NS |
| 2 | Fiscal/relational | NS (audit heuristics ≠ EFD rules) |
| 3 | Official PVA | NS — only when user attaches PVA result |

UI copy must distinguish these three forever.

---

## 6. What the current `/app/sped` page may claim

Allowed:

- “Diagnóstico / simulação”
- “Não substitui PVA”
- “Dados incompletos para geração”

Forbidden:

- “SPED válido”
- “Arquivo pronto para entrega”
- “C170 gerado” (nothing is generated)

---

## 7. Exit criteria to mark first `SUPPORTED` cell

1. Establishment + period + layout version resolved  
2. Tax normalizer tests green  
3. Golden TXT for scenario  
4. Internal validator level 1–2 green  
5. Manifest + SHA-256 of file  
6. Docs updated in this matrix  
7. Optional but preferred: PVA import matching zero critical errors for that fixture  

Until then: commercial page lists scenario as **em construção**.
