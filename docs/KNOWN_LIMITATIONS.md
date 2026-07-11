# Known Limitations

1. **IndexedDB** remains primary persistence on Vercel until Supabase is configured.  
2. **EFD COD_VER** placeholder `019` until official source registry is populated.  
3. **TIPO_ITEM=00** on 0200 requires accountant confirmation.  
4. **E110** not auto-generated from XML sums — apuração real still gated.  
5. **Stripe** checkout unavailable until `BILLING_PROVIDER=stripe` + keys; UI shows “Planos” demo.  
6. **Middleware** deprecation warning on Next 16 — migrate to `proxy` when adopting the new convention.  
7. **NFS-e** is not treated as EFD ICMS/IPI input.  
8. **Bloco 9 counters** are deterministic approximations — validate in PVA.  
9. **No A1/A3 certificate storage** by design in this version.  
10. AI remains mock (`ENABLE_AI=false`) and must not write fiscal records.  
11. **Cloud multi-tenancy / RLS live** blocked until Supabase project keys exist (schema + policies ready).  
12. **Web Worker import** falls back to main thread if the bundler rejects the worker URL.  
13. Export “Itens por CFOP e NCM” is **not** ICMS apuração — labeled explicitly.  
14. Landing/demo CTAs must not promise “SPED válido” or automatic conformity.
