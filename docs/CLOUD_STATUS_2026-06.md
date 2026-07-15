# Status de Persistência Cloud — 06/2026

**Classificação honesta:** `local_prototype`.

Conforme o superprompt §18, se os dados continuarem em IndexedDB, a cloud NÃO
deve ser declarada concluída. Esta seção documenta onde os dados realmente
vivem e quais adapters estão (ou não) ativos.

## Onde os dados são escritos/lidos hoje

| Dado | Local real de escrita/leitura | Mecanismo |
|---|---|---|
| Lotes / XML / Documentos (browser) | IndexedDB `"xml-fiscal-intelligence"` (store `batches`) | `src/lib/store/idb-store.ts` |
| Cadastro (empresas/estabelecimentos) | IndexedDB `"xfi_cadastro_v1"` | `src/lib/store/local-cadastro.ts` |
| Lotes / XML (server Node) | sistema de arquivos local `data/batches/<id>.json` | `src/lib/store/fs-store.ts` |
| Fechamentos / EFD / conciliações | cliente (IDB) + server (fs) | stores em `src/lib/store/*` |

## Camada de repositório (cloud)

- Existe abstração em `src/modules/repositories/` com contratos
  (`BatchRepository`, `CompanyRepository`, `EfdGenerationRepository`…) e dois
  adapters (`createIndexedDbBatchRepository`, `createSupabaseBatchRepository`).
- **Estado:** os adapters estão **definidos mas NUNCA invocados** no caminho de
  leitura/escrita em runtime. O cabeçalho de `contracts.ts` afirma "Cloud é a
  fonte de verdade", mas isso é **aspiracional**, não o que roda.
- O único factory ativo é o de storage (`src/lib/storage/provider.ts`):
  `getStorageProvider()` retorna `SupabasePrivateStorage` somente se
  `STORAGE_PROVIDER==="supabase"` + `hasServiceRole()`; caso contrário
  `LocalPrivateStorage` (escreve em `private-data/storage`).

## Supabase (metadados, unidirecional)

- Credenciais reais presentes em `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
  anon, service role, `DATABASE_URL`, `STORAGE_PROVIDER=supabase`,
  `FEATURE_CLOUD_PROCESSING=true`).
- Rotas de sync escrevem metadados (companies, batches, PVA runs, usage) de
  forma unidirecional e retornam `503 cloud_unavailable` quando o cloud está
  desligado.
- As rotas de leitura centrais (`GET /api/batches`, `GET /api/batches/[id]`)
  **não** tocam Supabase — leem `data/batches` do FS local.

## Conclusão

- Cloud = **`local_prototype`**. Não declarar "cloud concluída".
- Para concluir seria necessário: adapters Supabase invocados no runtime,
  APIs server-side, storage privado, jobs persistentes, idempotência,
  sincronização, resolução de conflito, RLS, logs, restore — e um teste
  cross-browser (navegador A importa → navegador B recupera). Este teste
  cross-browser está **`blocked_external`** neste ambiente.
- O aviso honesto (`LocalPersistenceBanner`) permanece na interface.
