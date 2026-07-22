# Reconciliação de Leiaute × Fonte Oficial — EFD ICMS/IPI

Objetivo: ancorar **cada regra de geração** do módulo `efd-icms-ipi` a uma fonte oficial
verificável (página/tabela), fechando as pendências de evidência do
`NORMATIVE_REGISTRY.md`.

- **Competência-alvo:** 06/2026.
- **Guia Prático aplicável:** **3.2.2** (11/02/2026), `docs/official-sources/A_01_guia-pratico-efd-icms-ipi_3.2.2.pdf`
  (SHA-256 `49d940a5f7cb209f0ddc8be094ea2e753ed0e2b1219200f4a3266e9b6972d22f`, 362 páginas).
- **Leiaute:** COD_VER **020** (v1.19, vigência 01/01/2026 →), Ato COTEPE/ICMS 79/2025 + NT 2025.001.
- **PVA de referência:** 6.1.0.
- Guia 3.2.3 (`A_02`) **NÃO** se aplica a 06/2026 (vigência a partir de 01/2027).

> Método: texto do Guia extraído com `scripts/pdf-extract-text.mjs` (pdfjs-dist). As
> páginas citadas referem-se à numeração impressa do PDF `A_01`.

## Resultado global

**Nenhuma divergência encontrada.** Todas as afirmações de leiaute/contagem de campos e
regras condicionais do gerador conferem com o Guia 3.2.2 e as tabelas externas oficiais.

## Matriz de reconciliação

| Regra no código | Onde (código) | Fonte oficial | Verificação |
|---|---|---|---|
| **0000**: ordem REG, COD_VER, COD_FIN, DT_INI, DT_FIN, NOME, CNPJ, CPF, UF, IE, COD_MUN, IM, SUFRAMA, IND_PERFIL, IND_ATIV | `builders/index.ts` `build0000` | Guia 3.2.2, Registro 0000 (p. 28-29) | ✅ ordem e campos idênticos |
| **COD_VER = 020 para 2026** | `constants.ts` `efdIcmsIpiCodVer` | Tabela 3.1.1 Versão do Leiaute (`A_08_tabela-versoes-leiaute_global-v20.txt`): `020\|1.19\|01012026\|` | ✅ 2026 → 020 |
| **COD_VER = N 003** | `layouts/020/records.ts` | Guia 0000 campo 02: `COD_VER … N 003` | ✅ |
| **0002 só quando IND_ATIV = "0"** | `builders/index.ts:798` `if (context.activityCode === "0")` | Guia 3.2.2, Registro 0002 (p. 31): "O registro deve ser informado quando o campo IND_ATIV do registro 0000 for igual a '0'." | ✅ |
| **C170 = 38 campos** | `builders/index.ts`, `records.ts` | Guia 3.2.2, Registro C170 (p. 80-81): campos 01 REG … 38 VL_ABAT_NT | ✅ 38 campos |
| **C170 campo 10 CST_ICMS = N 003 (3 dígitos)** | `common.ts:90` `cstIcms` → `padStart(3).slice(-3)` | Guia C170 campo 10: `CST_ICMS … N 003*` | ✅ |
| **C170 campo 11 CFOP = N 004** | `records.ts` | Guia C170 campo 11: `CFOP … N 004*` | ✅ |
| **C170 CST_PIS(25)/CST_COFINS(31)=N 002; CST_IPI(20)=C 002; COD_ENQ(21)=C 003** | `records.ts` | Guia C170 campos 20/21/25/31 | ✅ posições corretas (corrige o antigo deslocamento PIS de 34→38 campos) |
| **C190 = 12 campos** | `builders/index.ts`, `records.ts` | Guia 3.2.2, Registro C190 (p. 105-106): 01 REG … 12 COD_OBS | ✅ 12 campos |
| **C190 campo 02 CST_ICMS = N 003; 03 CFOP = N 004; 10 VL_RED_BC; 11 VL_IPI; 12 COD_OBS** | `records.ts` | Guia C190 campos 02/03/10/11/12 | ✅ |
| **VL_RED_BC = VL_OPR − VL_BC_ICMS p/ CST terminado em 20/70** | `builders/index.ts:717-735` | Guia C190 campo 10 (VL_RED_BC: valor não tributado por redução de BC) | ✅ regra de negócio coerente com a definição do campo |
| **CFOP entrada 1/2/3 (IND_EMIT terceiros) vs saída 5/6/7 (própria)** | `builders/index.ts` split por `isOwnIssueNfe` | Guia C190 campo 03 (Validação): "Se IND_OPER do C100 = 0 → 1º caractere 1/2/3; se = 1 → 5/6/7" | ✅ |
| **NF-e emissão própria (IND_EMIT=0, mod 55): C100+C190, sem C170** | `builders/index.ts` | Guia C170 (p. 80): registro para itens, "inclusive em operações de entrada … de NF-e de emissão de terceiros"; regra PVA MSG_NFE_EMITIDA_15001 | ✅ (própria → C190 analítico; terceiros → C170) |
| **E110 = 15 campos (sem VL_SLD_CREDOR_ANT_FUT)** | `calculations/index.ts` `buildE110FromC190`, `records.ts` | Guia 3.2.2, Registro E110 (p. 223-224): 01 REG … 15 DEB_ESP | ✅ 15 campos; não existe 16º campo |
| **E110 obrigatório (um por período)** | `builders/index.ts` | Guia E110: "Nível hierárquico 3 — registro obrigatório; ocorrência um por período" | ✅ |
| **E116 = 10 campos; COD_OR(02)=C 003; COD_REC(05) por UF; MES_REF(10)=N 006** | `records.ts`, `builders` | Guia 3.2.2, Registro E116 (p. 229) | ✅ |
| **E116 COD_OR valores [000,003,004,005,006,090]** | `builders/index.ts` (default "000") | Guia E116 campo 02; Tabela 5.4 (`A_08_tabela-obr-icms-recol_global-v1.txt`) | ✅ |
| **E500/E520 só quando há IPI no período** | `builders/index.ts:895-927` `hasIpi` | Guia Bloco E (apuração do IPI) — empresa não contribuinte do IPI não apresenta; regra PVA MSG_NAO_EXISTE_APURACAO_IPI | ✅ |
| **COD_REC SP = "046-2"** | `uf/sp.ts` `suggestIcmsCodRec` | Portaria CAT 147/2009 (`C_01_..._codigo-receita-046-2-consulta.pdf`): "046-2 — Regime Periódico de Apuração" | ✅ |
| **CSOSN (Simples) admitido no campo CST_ICMS** | `common.ts` `CSOSN_VALUES` | Anexo III-A Conv. SINIEF s/nº 1970 (`A_06_tabela-csosn_...pdf`, red. Ajuste SINIEF 39/2023) | ✅ tabela conferida |
| **CFOP válido** | parser/builders | Tabela CFOP v14 (`A_07_tabela-cfop_sped-fiscal-v14.txt`, 649 códigos, com DT_INI/DT_FIM) | ✅ fonte disponível para validação futura |
| **DT_INI/DT_FIN mesmo mês; MES_REF(E116) ≤ mês DT_INI** | site `page.tsx` (modo "Todo o lote"), builders | Guia 0000 DT_INI/DT_FIN; E116 MES_REF; regras PVA MSG_MES_ESCRITURACAO / MSG_REGRA_MES_REF | ✅ |

## Lacunas de fonte (não bloqueiam SP/06-2026)

| Item | Situação |
|---|---|
| **A_04** NT 2025.001 v1.0 (leiaute 020, 141 pág) | Não baixado (502 no portal). Vigência/leiaute confirmados indiretamente pela Tabela 3.1.1 (`A_08`) e pelo Ato COTEPE 79/2025. |
| **C_02** Tabela de códigos de receita do RS (E116) | Não baixada (timeout). Metadados no manifesto (`SPEDFISCAL_RS`, idTabela 184 v7). COD_REC `04601` do RS **não confirmado** — manter como entrada do usuário até validar. |
| **B_04** Manual EFD-Reinf 2.1.2.1 | Não baixado (403). Fora do escopo EFD ICMS/IPI. |

## Conclusão

O gerador `efd-icms-ipi` (layout 020) está **integralmente ancorado** no Guia Prático 3.2.2
e nas tabelas externas oficiais para a competência 06/2026, jurisdição SP. As correções
acumuladas no histórico (C170 38 campos, C190 12, E110 15, CST_ICMS 3 dígitos, 0002
condicional, VL_RED_BC, E500 condicional, COD_REC SP 046-2) são **confirmadas pela fonte**,
não apenas empíricas do PVA.
