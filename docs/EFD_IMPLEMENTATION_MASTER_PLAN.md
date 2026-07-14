# EFD ICMS/IPI — Master Plan (geração real / honestidade)

## Objetivo

TXT conforme leiaute aplicável à competência, com prontidão, validação interna, manifesto, linhagem e ciclo PVA assistido — **sem** declarar “oficial RFB” só porque o arquivo foi serializado.

## Status lifecycle

Ver `src/modules/obligations/efd-icms-ipi/status.ts` (`EfdGenerationStatus`).

## Arquitetura-alvo

```text
src/modules/obligations/efd-icms-ipi/
  status.ts          # lifecycle
  plugin.ts          # builders atuais
  versions/          # 2025 | 2026 | 2027 (a expandir)
  readiness/
  validators/
  serializers/
  lineage/
  pva/
```

## Fontes

- Portal SPED / EFD ICMS/IPI (gov.br)
- Guia Prático 3.2.3 (PDF local hash em `IMPLEMENTATION_BASELINE.md`) — vigência a cruzar com competências 2026/2027
- PVA: etapa externa (`PVA_VALIDATION_PROTOCOL.md`)

## Fases

| Fase | Entrega | Status |
| ---- | ------- | ------ |
| A | Status + manifesto + decimal | Parcial |
| B | Version resolver por competência | Pendente |
| C | Completar blocos com golden+PVA | Pendente |
| D | Persistência `efd_generations` cloud | Schema iniciado |
| E | Homologação PVA cenários | Externo |

## Registros

Mantém-se a matriz em `EFD_ICMS_IPI_SUPPORT_MATRIX.md`. Um registro só é “suportado” com builder + validator + fixture + evidência PVA.
