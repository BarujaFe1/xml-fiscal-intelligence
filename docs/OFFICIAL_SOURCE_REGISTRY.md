# Official Source Registry

Catálogo tipado: `src/modules/obligations/core/sources/catalog.ts`  
Tabela DB: `official_sources` (migration `202607110003`).

Verificação de URLs do SUPERMEGAPROMPT registrada em `lastVerifiedAt=2026-07-14` (rev. de catálogo).

Hash completo de PDFs oficiais **só** após conferência local — o Guia EFD 3.2.3 tem prefixo documentado; não promover `validated_scope` só com prefixo.

Benchmarks comerciais (Qive, Systax, Sovos, Avalara, Senior) **não** são fonte normativa.

## Uso

```ts
import { getOfficialSource, listOfficialSourcesByObligation } from "@/modules/obligations";
```
