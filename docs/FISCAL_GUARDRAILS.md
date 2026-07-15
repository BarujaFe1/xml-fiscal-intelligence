# Guardrails Fiscais (§19 PIS/COFINS, §20 Validação Histórica)

## PIS/COFINS — contexto obrigatório (§19)

Aceitar taxas por parâmetro **não** é motor fiscal. O cálculo/atribuição de
crédito exige contexto:

- regime tributário;
- competência;
- CST;
- CFOP;
- NCM;
- natureza da operação;
- tipo de crédito;
- estabelecimento;
- fonte oficial;
- vigência da regra;
- aprovação do responsável.

Quando o contexto estiver ausente, a interface deve apresentar
**"Classificação fiscal necessária"** e **não** calcular automaticamente.

- **IA para decidir crédito:** nunca reativada (ver `docs/AI_REMOVAL_REPORT.md`).
- **`sourceIds`:** quando exibidos ao usuário, apresentados como
  **"Fundamentação"** (referência à fonte oficial), não como id técnico.

Status de implementação: o sistema **não** possui motor de crédito PIS/COFINS
automático; a regra acima é a política vigente e deve ser respeitada em qualquer
tela de apuração.

## Validação histórica (§20)

`HISTORICAL_RECONCILIATION_RESULTS.md` **só** é evidência real se preenchido com
competências e arquivos autorizados. Estado atual: os dados de exemplo no repo
são **fixtures sintéticas** e NÃO devem ser chamados de "reconciliação
histórica".

Quando dados reais forem fornecidos, executar:
1. competência simples;
2. competência divergente;
3. competência com cancelamentos.

Comparar sistema × planilha; toa diferença deve ser explicada. Até lá, manter
como exemplo/sintético.
