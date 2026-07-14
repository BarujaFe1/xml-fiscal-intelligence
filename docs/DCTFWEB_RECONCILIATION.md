# DCTFWeb Reconciliation

**Status:** Fase 3 — import CSV only (sem portal)

## Uso

1. Exporte relatório oficial DCTFWeb (fora do produto)
2. Cole em `/app/reinf` no formato `periodo;cod_receita;valor`
3. `parseDctfWebImportCsv` + `reconcileDctfVsReinf` comparam por competência + valor (tolerância 0)

## Limitações

- Sem mapeamento completo código receita ↔ evento (ainda genérico por valor)
- Sem autenticação DCTFWeb
- Expectativas Reinf precisam de valores manuais/evento até totalizadores oficiais

Código: `src/modules/obligations/reinf/dctf/reconcile.ts`
