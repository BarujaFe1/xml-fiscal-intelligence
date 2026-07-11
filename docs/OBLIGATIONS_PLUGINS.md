# Obrigações fiscais — plugins ativos (assistidos)

Todos os cards em `/app/obligations` estão **active** com geração assistida:

| ID | O que gera | Honestidade |
| -- | ---------- | ----------- |
| efd-icms-ipi | TXT SPED Fiscal (já existente) | Pré-validação interna; PVA à parte |
| efd-contribuicoes | TXT draft blocos 0/A/M | Sem apuração M completa; sem transição 2027 |
| ecd | TXT esqueleto I050 DEMO | Sem lançamentos a partir de XML |
| ecf | TXT estrutural L/X/Y | Sem IRPJ/CSLL calculado |
| reinf | JSON R-1000 (+ candidatos) | Sem certificado / transmissão |

## Demonstração

1. UI: `/app/obligations/demo` → **Gerar todas as obrigações**
2. CLI: `npm run obligations:demo-samples` → `private-exports/obligations-demo/`
3. API: `POST /api/obligations/demo`

Sample: `samples/anonymized/nfe-example.xml`
