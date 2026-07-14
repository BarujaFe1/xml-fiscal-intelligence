# Cloud Migration Plan

## Princípio

PostgreSQL/Supabase = fonte da verdade no modo SaaS. IndexedDB = cache, fila, offline ou modo privado explícito — **não** duas fontes simultâneas.

## Contratos

`src/modules/repositories/contracts.ts`:

- FiscalDocumentRepository
- BatchRepository
- ImportJobRepository
- CompanyRepository
- EstablishmentRepository
- EfdGenerationRepository
- StorageProvider

Adapter atual: `createIndexedDbBatchRepository()` (local only).

## Fluxo de migração (alvo)

Estados `CloudMigrationStatus` em `status.ts`.

1. Descobrir lotes IDB  
2. Escolher workspace / empresa / estabelecimento / competência  
3. Inventário + hashes  
4. Upload privado + persistência  
5. Verificar contagens/hashes  
6. Confirmar; só então opcional limpar local  

## Storage path

```text
workspace/{workspaceId}/company/{companyId}/establishment/{establishmentId}/period/{YYYY-MM}/...
```

Buckets privados; URLs assinadas curtas; path gerado no servidor.

## Situação atual

- Página `/app/migrate` existe (metadata parcial históricamente).
- Migração completa idempotente + RLS storage **ainda não** é produção.

## Próximos PRs

1. Implementar repositórios Supabase concretos.  
2. Signed upload/download.  
3. Job pipeline com retry.  
4. Testes de migração repetida sem duplicar documentos.
