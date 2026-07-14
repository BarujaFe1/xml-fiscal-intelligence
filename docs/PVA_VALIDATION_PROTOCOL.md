# PVA Validation Protocol (EFD ICMS/IPI)

## Papel do PVA

Validador **oficial externo** da Receita. O SaaS gera TXT e registra resultado — **não** embute/redistribui o PVA.

## Proibido

- Instalar PVA no repositório  
- Redistribuir instalador  
- Eng. reversa / automação obscura da UI  
- Declarar API oficial inexistente  
- Guardar certificado/senha improvisados  

## Fluxo assistido (obrigatório)

1. Gerar TXT no app (status → `txt_generated` / `pva_validation_pending`)  
2. Baixar arquivo  
3. Importar no PVA oficial (Windows; Linux somente se o instalador oficial cobrir)  
4. Executar validação  
5. Exportar/copiar relatório  
6. Registrar no app: versão PVA + relatório + status (`pva_validated` / `pva_rejected`)  
7. Corrigir dados/regras → **nova geração imutável**  
8. Repetir  

## Windows (resumo)

1. Baixar PVA do canal oficial RFB/SPED download (`gov.br` / sped.rfb.gov.br).  
2. Instalar conforme instalador.  
3. Abrir → Importar escrituração → selecionar TXT.  
4. Validar → salvar relatório de erros/advertências.  
5. Anotar **versão exata** do PVA.  
6. Colar/anexar no módulo EFD do app.  

## Linux

Usar apenas se existir instalador/procedimento **oficial**. Caso contrário, validar em Windows controlado e anexar evidências.

## Evidências a guardar (storage privado)

- Versão PVA  
- Hash do TXT  
- Relatório bruto  
- Competência / estabelecimento / layout  
- Resultado (aceito / rejeitado / advertências)  

## Matriz

Ver `docs/PVA_TEST_RESULTS.md` (preencher com evidências reais; vazio ≠ aprovado).
