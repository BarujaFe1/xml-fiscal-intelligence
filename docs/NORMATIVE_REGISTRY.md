# Registro Normativo — EFD ICMS/IPI (competência 06/2026)

Critério (superprompt §3): para 06/2026 usar **Guia Prático 3.2.2** + leiaute da
competência. A versão **3.2.3** tem vigência **apenas a partir de 01/2027** e
**NÃO** deve ser usada para gerar junho de 2026.

## Fontes oficiais consultadas (URLs informadas no superprompt)

| URL | Título | Versão aplicável | Vigência | Hash do PDF | Data da consulta |
|---|---|---|---|---|---|
| https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/download/sped/efdi | SPED EFD ICMS/IPI — downloads | Guia Prático 3.2.2 | vigente em 06/2026 | não baixado neste ambiente (`blocked_external`) | 2026-07-15 |
| https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi | EFD ICMS/IPI (página do programa) | — | — | — | 2026-07-15 |
| https://www.gov.br/sped/pt-br/assuntos/comunicados/nova-versao-do-guia-pratico-da-efd-icms-ipi | Comunicado: nova versão do Guia Prático | 3.2.3 | **a partir de 01/2027** | — | 2026-07-15 |
| https://www.gov.br/sped/pt-br/assuntos/comunicados/efd-icms-ipi/nova-versao-do-guia-pratico-da-efd-icms-ipi-1 | Comunicado: nova versão do Guia Prático (2) | 3.2.3 | **a partir de 01/2027** | — | 2026-07-15 |

## Decisão de versionamento para 06/2026

- **Leiaute / Guia Prático:** `3.2.2` (`COD_VER = 020` para 2026, conforme `src/modules/obligations/efd-icms-ipi/plugin.ts` `efdIcmsIpiCodVer`).
- **PVA de referência:** `6.1.0` (ou versão oficial mais recente confirmada no dia da execução pelo usuário).
- **Não** usar 3.2.3 para junho de 2026.

## Pendências de evidência

- Hash SHA-256 dos PDFs oficiais: **não obtido** neste ambiente (bloqueado:
  download de binário + cálculo de hash não executado). Deve ser preenchido
  quando o PDF for baixado em ambiente com acesso.
- Confirmação da versão exata do PVA utilizada pelo usuário (informada como
  "PVA EFD ICMS/IPI 6.1.0 ou versão oficial mais recente"): registrar no
  `validation-run.json` ao obter o relatório detalhado.
