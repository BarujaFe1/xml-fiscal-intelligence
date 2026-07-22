# Official Source Registry

Catálogo tipado: `src/modules/obligations/core/sources/catalog.ts`  
Tabela DB: `official_sources` (migration `202607110003`).

Verificação de URLs do SUPERMEGAPROMPT registrada em `lastVerifiedAt=2026-07-14` (rev. de catálogo).

Cópias locais oficiais em `docs/official-sources/` (extraídas de `pdfs-oficiais-sped.zip`),
com íntegras verificadas contra `SHA256SUMS.txt` (26/26 OK, 2026-07-18). O Guia 3.2.2
(`A_01`, SHA-256 `49d940a5…6972d22f`) é a fonte aplicável a 06/2026 e está reconciliado
campo a campo em `docs/EFD_LAYOUT_SOURCE_RECONCILIATION.md`. Os hashes completos do Guia
3.2.2 e 3.2.3 já constam em `catalog.ts` (não mais prefixos).

Benchmarks comerciais (Qive, Systax, Sovos, Avalara, Senior) **não** são fonte normativa.

## Uso

```ts
import { getOfficialSource, listOfficialSourcesByObligation } from "@/modules/obligations";
```
