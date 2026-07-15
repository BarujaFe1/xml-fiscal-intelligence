# Relatório de Erros de Importação — PVA (06/2026)

**Classificação desta geração:** `pva_rejected` (NÃO homologada, NÃO oficial, NÃO pronta para transmitir).

## Origem da evidência

- Screenshot do "Relatório de Erros de Importação" do PVA, fornecido pelo usuário.
- O screenshot contém **apenas o resumo**: competência, perfil, total de erros e categoria.
- **Não** há, no ambiente desta execução, o relatório detalhado (registro / campo / linha / valor esperado).

## Dados conhecidos (do resumo)

| Campo | Valor |
|---|---|
| Competência | junho de 2026 (06/2026) |
| Perfil | A |
| Total de erros | 2 |
| Categoria | Campo obrigatório |
| PVA utilizado em | 15/07/2026 |
| Arquivo | TXT gerado pelo sistema (06/2026, perfil A) |

## Dados NÃO disponíveis (ausentes no resumo)

- registro (ex.: 0000, 0005, 0150…)
- campo (ex.: COD_MUN, END, CEP…)
- número da linha
- conteúdo / valor atual
- mensagem detalhada
- valor esperado

## Decisão (conforme superprompt §4)

> Não tente adivinhar quais são os dois campos. Não marque como homologada. Não crie valores fictícios para fazer o arquivo passar.

Portanto:
- a correção **específica** dos dois campos está classificada como **`blocked_external`**;
- a geração permanece **`pva_rejected`**;
- o arquivo reprodutível para o usuário rodar no PVA dele está em
  `private-exports/probe-efd-fix/efd.txt` (06/2026, perfil A);
- a infraestrutura de importação, mapeamento e pré-validação foi implementada
  (ver `src/app/app/obligations/efd-icms-ipi/pva/page.tsx`,
  `src/modules/obligations/efd-icms-ipi/prevalidate.ts`,
  `supabase/migrations/202607150001_pva_field_definitions.sql`).

## Próximo passo para desbloquear

1. Abrir o TXT no PVA do usuário.
2. Selecionar "Erros" → "Exibir" → relatório detalhado.
3. Capturar/exportar todas as páginas.
4. Preencher `detailed-errors.sanitized.json` com registro/campo/linha/mensagem/valor.
5. Rodar o pré-validador contra o contexto e aplicar a correção na origem.
6. Gerar nova geração **imutável** (Generation 2) e validar novamente.
