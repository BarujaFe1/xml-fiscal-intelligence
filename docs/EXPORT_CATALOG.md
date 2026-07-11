# Export Catalog

| Grupo | Export | Conteúdo | Disclaimer |
| ----- | ------ | -------- | ---------- |
| Dados brutos | Excel completo | Abas padrão do lote | — |
| Dados brutos | CSV documentos/itens | Uma linha por entidade | CSV injection sanitized |
| Relatórios | HTML | Resumo executivo | — |
| Relatórios | Entradas x Saídas | Movimento documental | Não é DRE |
| Operacional | Itens CFOP/NCM | Itens sem cálculo tributário | **Não é apuração de ICMS** |
| Auditoria | Divergências | Sem chave/protocolo + warnings | — |
| Diagnóstico EFD | TXT + manifesto | Pré-validação interna | Conferir no PVA |

Implementação: `src/app/app/batches/[id]/exports/page.tsx`, `src/lib/export/excel.ts`, `src/lib/export/sanitize.ts`.
