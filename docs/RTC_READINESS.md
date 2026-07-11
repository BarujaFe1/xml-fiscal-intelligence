# Reforma Tributária do Consumo (RTC) — Readiness

**Date:** 2026-07-11  
**Status:** Foundation / parser-preserving — **not** claiming CBS/IBS/IS compliance.

## Official orientation

- [Reforma Tributária do Consumo](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo)
- [Orientações 2026](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026)

## Documents affected (expected)

| Document | Impact | Current support |
| -------- | ------ | --------------- |
| NF-e / NFC-e | New tax groups (CBS/IBS/IS) over time | Flatten preserves unknown tags |
| CT-e | Possible new groups | Same |
| NFS-e | Municipal + future IBS/CBS | Best-effort ABRASF-like |
| EFD ICMS/IPI | Do **not** mix CBS/IBS/IS into ICMS blocks without official rule | Explicitly excluded |

## Current engineering stance

1. Original XML kept (hash + content) when imported.
2. Flatten registers unknown paths — do not silent-drop.
3. Presence of a tag ≠ conformity.
4. Schema version should be recorded when detectable (follow-up: `schema_versions` table already seeded path).
5. Feature flag: `FEATURE_RTC_PARSING=true` (opt-in hooks; no invented rates).

## Pendencies

- Typed extractors for CBS/IBS/IS groups when official XSD/NT publish stable tags for the target competence.
- Separate fiscal mapping layer from parser.
- Reprocessing jobs when rule versions change.
- Do not include RTC taxes in EFD ICMS/IPI generation without applicable official guidance for the period.

## Risks

- Premature mapping of transitional tags.
- Mixing 2025/2026/2027 rule sets by competence incorrectly.
- UI claiming “reforma ready” without PVA/SEFAZ evidence.
