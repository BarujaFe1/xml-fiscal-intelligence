# PVA Test Results

| Cenário | Competência | Leiaute | UF | Perfil | PVA | Resultado | Evidência |
| ------- | ----------- | ------- | -- | ------ | --- | --------- | --------- |
| _(nenhum aceito nesta máquina nesta branch)_ | — | — | — | — | — | **pendente** | — |

## Barra de homologação (Fase 2)

Um registro conta para `validated_scope` / `official_validator_beta` **somente** se:

1. `contentHash` do TXT gerado (SHA-256)
2. `pvaVersion` preenchida
3. `resultStatus` ∈ {ok, warnings, errors} (não `unknown`)
4. Evidência fora do Git (storage privado) ou manifesto referenciado
5. Fixture/cenário identificado

API: `homologationGrade: true` quando os itens 1–3 passam (`isHomologationGradePvaRun`).

Regra: cenário só é “suportado” com linha **aceito** e artefato anexado.
