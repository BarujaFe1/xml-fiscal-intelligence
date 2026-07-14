# Evidence Vault

**Status:** `internal_beta` (Fase 7) — metadata operacional

## O que guarda

- `contentHash`, programa oficial, versão, status, responsável
- `generationId` ligando à geração imutável
- `storageRef` lógico para storage **privado** (não no git)

## O que NÃO guarda

- Binários RFB / PVA / Programa ECD-ECF no repositório
- Payloads enormes inline (`assertNoBinaryPayload`)

## Código

- Domínio: `src/modules/ops/evidence.ts`
- IDB: `xfi_ops_v1` / API `POST /api/v1/evidence`
- Migration: `202607140008_ops_platform.sql`
