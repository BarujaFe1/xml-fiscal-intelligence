# PVA Evidence â€” EFD ICMS/IPI â€” GeraÃ§Ã£o 1 (2026-06, Perfil A)

Pacote de evidÃªncia imutÃ¡vel da GeraÃ§Ã£o 1 do arquivo EFD ICMS/IPI gerado pelo app.

- **Arquivo:** \$DestName\ (cÃ³pia byte-a-byte de \private-exports/probe-efd-fix/efd.txt\)
- **SHA-256:** \$sha\
- **Tamanho:** 488275 bytes Â· **BOM:** none Â· **EOL:** CRLF Â· **Linhas:** 5246
- **Registros (aprox.):** 4923
- **Status:** \pva_pending\ â€” aguardando validaÃ§Ã£o no PVA oficial (SpedEFD.exe)

## PrÃ³ximo passo
Importar \$DestName\ no SpedEFD.exe, rodar a validaÃ§Ã£o e registrar os erros
bloqueantes em \manifest.json > pva.errors\ (via \scripts/pva/parse-pva-report.ps1\
ou import manual). O \boutVersion\ deve ser preenchido com a versÃ£o real do PVA
(launcher reporta 2.1.1-SNAPSHOT; a versÃ£o do aplicativo PVA Ã© outra â€” ver tela "Sobre").
