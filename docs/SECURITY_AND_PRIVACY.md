# Security and Privacy

## Threat model (MVP)

- Malicious ZIP (zip slip, bombs, executables)
- Malicious XML (XXE, entity expansion)
- Accidental leak of real fiscal XMLs to GitHub

## Controls

| Risk | Control |
|------|---------|
| Zip slip | Reject `..` and absolute paths |
| Executables in ZIP | Extension denylist |
| XXE | `processEntities: false` |
| Real data in git | `.gitignore` for `data/`, `private-test-data/`, `*.zip` |
| UI exposure | CNPJ/CPF masking toggle |
| Secrets | `.env.example` only; no keys committed |

## Rules for contributors

1. Never commit real XMLs or ZIPs from SIEG  
2. Put real test files only in `private-test-data/`  
3. Prefer `scripts/anonymize-xml.ts` before sharing samples  
4. Do not send fiscal payloads to third-party AI/APIs without explicit user consent  

## Demo vs real

- `ENABLE_DEMO_MODE` / `ENABLE_MASKING` in env  
- Settings page stores local masking preference  
