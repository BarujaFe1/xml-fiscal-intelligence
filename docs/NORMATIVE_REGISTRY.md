# Registro Normativo — EFD ICMS/IPI (competência 06/2026)

Critério (superprompt §3): para 06/2026 usar **Guia Prático 3.2.2** + leiaute da
competência. A versão **3.2.3** tem vigência **apenas a partir de 01/2027** e
**NÃO** deve ser usada para gerar junho de 2026.

## Fontes oficiais consultadas (arquivos locais verificados)

Cópias locais em `docs/official-sources/` (íntegras conferidas contra `SHA256SUMS.txt`, 26/26 OK, 2026-07-18).
Reconciliação leiaute×fonte em `docs/EFD_LAYOUT_SOURCE_RECONCILIATION.md`.

| Arquivo local | Título | Versão aplicável | Vigência | SHA-256 | Data da consulta |
|---|---|---|---|---|---|
| `A_01_guia-pratico-efd-icms-ipi_3.2.2.pdf` | Guia Prático EFD ICMS/IPI 3.2.2 | **3.2.2 (aplicável a 06/2026)** | 01/01–31/12/2026 (leiaute 020) | `49d940a5f7cb209f0ddc8be094ea2e753ed0e2b1219200f4a3266e9b6972d22f` | 2026-07-18 |
| `A_02_guia-pratico-efd-icms-ipi_3.2.3-vigencia-2027.pdf` | Guia Prático EFD ICMS/IPI 3.2.3 | 3.2.3 | **a partir de 01/2027** | `bde603281ce8ad1e9f6f521a3df3ef825e6333497e30dfb9c01de8ecaa81c25b` | 2026-07-18 |
| `A_03_ato-cotepe-icms-79-2025_texto-oficial-consulta.pdf` | Ato COTEPE/ICMS 79/2025 | leiaute 020 | DOU 25/06/2025 | `6f205e79160586812f15a34108a4f77c6d49a896b95ec3b35709d429793d6255` | 2026-07-18 |
| `A_08_tabela-versoes-leiaute_global-v20.txt` | Tabela 3.1.1 Versão do Leiaute | v20 | `020\|1.19\|01012026\|` | `c1ba0bf33c810d3e2ae4906d22af9c6d0995f2c1fbba362a8789a31ea51cd669` | 2026-07-18 |
| `C_01_portaria-cat-147-2009_codigo-receita-046-2-consulta.pdf` | Portaria CAT 147/2009 (COD_REC SP 046-2) | consolidada | vigente | `a5b97c046e708d36df7822ff7a0983cab44790e75a269fbbd3ec02896f769224` | 2026-07-18 |

## Decisão de versionamento para 06/2026

- **Leiaute / Guia Prático:** `3.2.2` (`COD_VER = 020` para 2026, conforme `src/modules/obligations/efd-icms-ipi/plugin.ts` `efdIcmsIpiCodVer`).
- **PVA de referência:** `6.1.0` (ou versão oficial mais recente confirmada no dia da execução pelo usuário).
- **Não** usar 3.2.3 para junho de 2026.

## Pendências de evidência

- Hash SHA-256 dos PDFs oficiais: **obtido e verificado** (2026-07-18) — cópias locais em
  `docs/official-sources/`, íntegras conferidas contra `SHA256SUMS.txt` (26/26 OK).
- **NT 2025.001 v1.0** (arquivo original): não baixada (portal retornou 502). Vigência e
  leiaute 020 confirmados indiretamente pela Tabela 3.1.1 (`A_08`) e pelo Ato COTEPE 79/2025.
- **Tabela de códigos de receita do RS** (E116 COD_REC): não baixada (timeout). COD_REC
  `04601` do RS permanece como entrada do usuário até validação com a tabela oficial.
- Confirmação da versão exata do PVA utilizada pelo usuário (informada como
  "PVA EFD ICMS/IPI 6.1.0"): registrar no `validation-run.json` ao obter o relatório detalhado.
