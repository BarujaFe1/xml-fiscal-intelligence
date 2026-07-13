# Known Limitations

1. **IndexedDB** permanece a fonte de verdade para XML/lote no browser; cloud/Supabase registra metadados de forma parcial.  
2. **COD_VER** EFD deriva do ano de `DT_FIN` (ex.: 020 em 2026) — conferir tabela do Ato COTEPE no PVA.  
3. **TIPO_ITEM=00** em 0200 exige confirmação do contador.  
4. **E110/E116** são rascunho derivado dos C190; saldo anterior/ajustes/COD_REC estadual não são inventados.  
5. **Stripe** checkout indisponível até `BILLING_PROVIDER=stripe` + keys; UI de planos é demonstração.  
6. Next 16 usa `src/proxy.ts` (ex-middleware).  
7. **NFS-e** não alimenta EFD ICMS/IPI; parser municipal é best-effort.  
8. Contadores do **Bloco 9** são determinísticos aproximados — validar no PVA.  
9. **Sem armazenamento de certificado A1/A3** nesta versão.  
10. IA permanece mock (`ENABLE_AI=false`) e não escreve registros fiscais.  
11. Supabase/RLS podem existir no projeto; sync completo de XML bruto multi-tenant ainda parcial.  
12. Web Worker de import faz fallback para main thread se o bundler rejeitar a URL.  
13. Export “Itens por CFOP e NCM” **não** é apuração de ICMS.  
14. Landing/demo **não** prometem “SPED válido” ou conformidade automática.  
15. `/api/ready` `commercialReady` permanece false até billing real.  
16. IE/CNPJ de fixtures demo podem falhar dígito verificador no PVA — use emitente real do lote.  
