# EFD ICMS/IPI — Support Matrix

> Status vocabulary for commercial honesty.  
> A cell may only be marked **Supported** / **PVA** when: automated test + fixture + versioned rule + known result (+ PVA evidence with contentHash) exist.

**Product snapshot (2026-07-14 — Fase 2 commons):** geração assistida `internal_beta`. Sem células PVA preenchidas. Pronto para registrar evidências no lab.

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

---

## 1. Platform prerequisites

| Capability | Status | Evidence |
|------------|--------|----------|
| XML NF-e ingest | INTERNAL path | parser tests |
| Obligation plugin + readiness | INTERNAL | unit |
| TXT serializer + hash | INTERNAL | unit |
| Block order L1 | INTERNAL | `validateBlockOpenerOrder` |
| XML × EFD audit | PARTIAL | `audit/xml-vs-efd` unit |
| UF plugins | PARTIAL skeleton | SP empty COD_REC table |
| PVA report import + homologationGrade | INTERNAL tooling | workflow + API flag |
| Auth / RLS multiuser proof | PARTIAL | schema policies |
| Transmission | NS | out of scope |

---

## 2. Blocks & records (generation)

| Block / Record | Status now | Notes |
|----------------|------------|--------|
| 0000 | INTERNAL | COD_VER por DT_FIN |
| 0005 | PARTIAL→INTERNAL | exige CEP/END/BAIRRO |
| 0100 | PARTIAL | exige CRC |
| 0150 | PARTIAL | IE / COD_MUN |
| 0190 / 0200 | PARTIAL | TIPO_ITEM=00 revisão |
| 0400 | PARTIAL | de natOp quando presente |
| C100 | PARTIAL→INTERNAL | COD_SIT cancel derivado |
| C170 | NA/INTERNAL omit | eletrônico com chave |
| C190 | PARTIAL | COD_OBS vazio |
| E100/E110 | PARTIAL | priorCreditBalance manual |
| E116 | PARTIAL | COD_REC manual/UF table |
| G/H/K | NS | Fase 2b |
| 9900/9990/9999 | INTERNAL | auto |

---

## 3. Scenario matrix

| Obligation | Period | Layout | UF | Perfil | Scenario | PVA | Result |
|------------|--------|--------|----|--------|----------|-----|--------|
| EFD ICMS/IPI | 2026-06 | draft | SP | A | NF-e amostra anônima | — | INTERNAL unit only |

Fill PVA column only with homologationGrade evidence.

---

## 4. Exit to first `SUPPORTED` / `PVA` cell

Ver `docs/PVA_TEST_RESULTS.md` barra de homologação + fixture + golden + revisor.
