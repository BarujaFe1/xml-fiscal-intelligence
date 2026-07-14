# EFD ICMS/IPI — Professional Scope

**Maturidade:** `internal_beta` (Fase 2 commons)  
**Fontes:** catálogo `official:sped:efd-icms-ipi:*` + Guia 3.2.3 local

## Suportado (parcial / assistido) — Fase 2

- Bloco 0: 0000/0001/0005/0100/0150/0190/0200/**0400**
- C: C100/C190; C170 omitido em eletrônico; COD_SIT cancel
- E: E100/E110 com **saldo anterior manual**; E116
- Fechamento 9 · prontidão · manifesto · hash
- Auditoria XML×EFD (chaves/totais)
- Plugins UF (esqueleto; SP sem seed inventado)
- Lab PVA com `homologationGrade` (exige contentHash)

## Não suportado

G/H/K completos · tabelas UF populadas · transmissão · CBS/IBS/IS · `validated_scope` sem evidência PVA

## Roadmap

- **2b:** G/CIAP, H, K, UF tables com fonte
- Subir para `official_validator_beta` na **1ª** evidência PVA real com hash
