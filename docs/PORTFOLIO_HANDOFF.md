# Portfolio handoff — XML Fiscal Intelligence

**Branch:** `chore/portfolio-quality-pass`  
**Prod:** https://xml-fiscal-intelligence.vercel.app  
**Repo:** https://github.com/BarujaFe1/xml-fiscal-intelligence  
**Data:** 2026-07-13

## Resumo executivo

Lab full-stack de **ETL fiscal + analytics operacional**: ZIP de XML → normalização → busca/export → auditoria heurística → rascunho EFD assistido. Adequado a discussões de analytics engineering / data product / full-stack analítico — **não** como SaaS enterprise pronto nem PVA oficial.

## Before / after (este passe)

| Antes | Depois |
|-------|--------|
| README com tom “premium/enterprise” e claims amplos | README honesto: lab, limites, matriz de parser |
| Poucas fixtures além de `samples/anonymized` | Fixtures sintéticas: NF-e namespaced, NFC-e 65, cancelamento |
| `KNOWN_LIMITATIONS` desatualizado (COD_VER/E110) | Limitações alinhadas ao código atual |
| Handoff antigo focado em “enterprise upgrade” | `PORTFOLIO_HANDOFF` + demo 3–5 min + guia de screenshots |
| Sem artefato externo de consolidação | Supermegaprompt em `C:\dev\prompts_para_port\` |

## Baseline de gates (este passe)

```text
npm run typecheck  → pass
npm run lint       → 0 errors (warnings só em scripts locais untracked)
npm run test       → 116+ pass (antes); + fixtures sintéticas
npm run build      → executar no final do passe
```

## Bugs / inconsistências tratados neste passe

- **P0 corrigido:** NFC-e era detectada mas `buildSummary`/`buildItems` não chamavam extractors NF-e.  
- Documentação contraditória (E110 “não gerado”, COD_VER `019` fixo) vs código atual  
- Claims de portfólio “premium” suavizados  
- Lacuna de testes: namespaces prefixados, NFC-e, evento de cancelamento  

## O que o código já sustentava (confirmado)

- Parser NF-e / NFC-e / CT-e / NFS-e (best-effort) / eventos — `src/lib/parser`  
- XXE guard (`processEntities: false`), Zip Slip — import pipeline  
- EFD assistido client-side (evita body limit) + leiaute Guia 3.2.3  
- Samples anonimizados commitáveis  

## Limitações remanescentes

Ver `docs/KNOWN_LIMITATIONS.md`. Destaques: IndexedDB como SoT de lote; EFD ≠ PVA; NFS-e municipal; Stripe/AI demo.

## Comandos de demo

```bash
npm install && cp .env.example .env.local && npm run dev
# Compactar samples → private-imports/samples.zip (ver README)
# Upload → lote → busca → export → Obrigações EFD (Preencher demo)
```

## Próximos passos (honestos)

1. Playwright E2E upload → busca → export  
2. Screenshots commitados em `docs/assets/` após captura local  
3. Sincronizar topics/description do GitHub com o README  
4. Não expandir billing/Stripe até evidência real  

## Recomendação de destaque

**Selecionado / lab forte** para analytics engineering e data product — não “arquivo”, não “enterprise production” sem ressalvas.
