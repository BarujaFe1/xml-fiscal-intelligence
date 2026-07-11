# Known Limitations

1. **IndexedDB** remains primary storage for full XML payloads; cloud migrate currently registers batch **metadata** only.  
2. **EFD COD_VER** placeholder `019` until official source registry is populated.  
3. **TIPO_ITEM=00** on 0200 requires accountant confirmation.  
4. **E110** not auto-generated from XML sums — apuração real still gated.  
5. **Stripe** checkout unavailable until `BILLING_PROVIDER=stripe` + keys; UI shows “Planos” demo.  
6. Next 16 routing uses `src/proxy.ts` (former middleware convention).  
7. **NFS-e** is not treated as EFD ICMS/IPI input.  
8. **Bloco 9 counters** are deterministic approximations — validate in PVA.  
9. **No A1/A3 certificate storage** by design in this version.  
10. AI remains mock (`ENABLE_AI=false`) and must not write fiscal records.  
11. Supabase project live (`uaqydwvdmwrwlvznoztd`) with RLS; full multi-tenant document sync still partial.  
12. **Web Worker import** falls back to main thread if the bundler rejects the worker URL.  
13. Export “Itens por CFOP e NCM” is **not** ICMS apuração — labeled explicitly.  
14. Landing/demo CTAs must not promise “SPED válido” or automatic conformity.  
15. `/api/ready` `commercialReady` stays false until Stripe is live.
