# Screenshots — guia de captura (sem PII)

Salvar em `docs/assets/` com nomes:

| Arquivo | Tela | Notas |
|---------|------|-------|
| `01-landing.png` | `/` | Hero + matriz de parser |
| `02-upload.png` | `/app/upload` | Dropzone + disclaimer |
| `03-batch-dashboard.png` | lote | Contagens / quality |
| `04-search.png` | busca | Query sem CNPJ real |
| `05-document-detail.png` | detalhe | Tags flatten |
| `06-export.png` | export | Formatos |
| `07-efd-demo.png` | obrigações EFD | Banner de honestidade |

## Regras

1. Usar **apenas** samples anonimizados ou mascaramento ligado  
2. Não capturar IE/CNPJ reais, caminhos `C:\Users\...` com nome pessoal se evitável  
3. Preferir tema padrão do app; 1280×720 ou 1440×900  

## Comando sugerido (Playwright local)

```bash
npm run dev
# em outro terminal, após instalar browsers:
npx playwright screenshot http://localhost:3000 docs/assets/01-landing.png --viewport-size=1440,900
```

Repetir URLs autenticadas/local app conforme necessário. Até a captura, o README aponta este guia — não inventar screenshots.
