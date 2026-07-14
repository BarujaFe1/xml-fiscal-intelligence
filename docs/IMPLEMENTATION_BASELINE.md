# Implementation Baseline — feat/cloud-multiuser-official-efd

**Date:** 2026-07-14  
**Branch:** `feat/cloud-multiuser-official-efd`  
**Parent:** `chore/portfolio-quality-pass` (+ cadastro multi-empresa PDF local)  
**Prompt:** SUPERMEGAPROMPT EFD real + cloud + multiusuário + remoção IA

## Toolchain

| Tool | Version |
| ---- | ------- |
| Node | v22.14.0 |
| npm | 10.9.2 |
| Next.js | 16.2.10 |
| React | 19.2.4 |

## Quality gate (início desta branch)

| Suite | Result |
| ----- | ------ |
| `npm run typecheck` | pass |
| `npm run test` | **129** passed / 1 skipped (130) |
| `npm run lint` | 9 errors pré-existentes + hooks `use*` (corrigidos); warnings massivos em bundle |
| `npm run build` | a repetir após remoção IA |
| `npm run test:e2e` | bloqueado nesta máquina até Playwright browsers |

## PDF Guia Prático anexado (Downloads)

| Campo | Valor |
| ----- | ----- |
| Arquivo local | `C:\Users\User1\Downloads\file.pdf` |
| SHA-256 | `bde603281ce8ad1e9f6f521a3df3ef825e6333497e30dfb9c01de8ecaa81c25b` |
| Páginas | 366 |
| Título (meta) | GUIA PRÁTICO DA ESCRITURAÇÃO FISCAL DIGITAL - EFD |
| Cabeçalho p.1 | Guia Prático EFD-ICMS/IPI — Versão **3.2.3** |
| Atualização | **06 de maio de 2026** |
| Uso na competência | Confirmar no portal SPED antes de misturar com 2026 vs 2027; o gerador atual declara layout `EFD_ICMS_IPI_LAYOUT_2026` — **não** tratar 3.2.3 como regra única sem matriz de vigência |

## Inventário rápido (estado real)

| Área | Estado |
| ---- | ------ |
| Import ZIP + IndexedDB | Produção local |
| Parser NFe/NFCe/CTe | Funcional parcial |
| EFD ICMS/IPI TXT | Geração assistida local + pré-validação; PVA assistido |
| Auth Supabase SSR | Preparado; depende de env |
| RLS schemas | Migrations existem; testes RLS incompletos |
| Cloud = fonte da verdade | **Não** — IDB ainda predomina |
| IA | **Removida nesta branch** (ver `AI_REMOVAL_REPORT.md`) |
| Cadastro empresas PDF SIEG | Local IndexedDB (esta linha de trabalho) |

## Rollback

```bash
git checkout chore/portfolio-quality-pass
# ou reset da branch feat/cloud-multiuser-official-efd
```

Não fazer push/deploy sem autorização.
