# Audit Findings Resolution

**Branch:** `feat/enterprise-production-hardening`  
**Method:** reproduce from code → classify → fix → regression test.  
**Billing:** BILLING-001/002 deferred by product decision (Stripe later).

| ID | Achado | Evidência recebida | Reprodução | Estado | Correção | Teste de regressão | Commit |
| -- | ------ | ------------------ | ---------- | ------ | -------- | ------------------ | ------ |
| DATA-001 | Score premia lote sem docs avaliados | Auditoria: 1147 XMLs todos conhecidos → score 80 “saudável” | `documents.length\|\|1` + dims em 100 com amostra 0 | `verified` | MetricEvaluation; score null se não avaliado; UI PT-BR | `tests/unit/quality-score.test.ts` | `2ff4fe2` |
| DATA-002 | Incremental sem linhagem de reutilizados | Relato | skip só em importLogs | `verified` | `ReusedDocumentReference` + `idbCollectKnownHashIndex` + UI/export | hardening-wave2/3 | wave |
| DATA-003 | Métricas 0/0 confundem | Relato | mesmo root cause DATA-001 | `verified` | coberto com DATA-001 | quality-score | `2ff4fe2` |
| DATA-004 | Logs exportam IDs completos | Relato | logs/export | `implemented` | redaction em logs + mask chaves/CNPJ em export + SQL preview | hardening-wave2 | wave |
| EXPORT-001 | JSON vazio não autodescritivo | Relato | bare store JSON | `verified` | ExportEnvelope + emptyReason | export-manifest.test | `17fb6d9` |
| EXPORT-002 | CSV só cabeçalho | Relato | headers only | `verified` | BOM + meta comments | export-manifest.test | `17fb6d9` |
| EXPORT-003 | XLSX “Sem dados” | Relato | addSheet Sem dados | `verified` | empty meta row | — | `17fb6d9` |
| EXPORT-004 | Falta manifesto transversal | Relato | — | `verified` | GenerationManifest | export-manifest.test | `17fb6d9` |
| EXPORT-005 | HTML impressão | Relato | — | `implemented` | viewport + @media print | — | `17fb6d9` |
| SEC-002 | Headers segurança | next.config | missing | `implemented` | CSP/HSTS/etc in next.config.ts | build | `17fb6d9` |
| FISCAL-001 | Sem protocolo / ruído | Código: collapse ≥60% | partial | `implemented` | `isProtocolRequired` + engine/quality | hardening-wave2 | wave |
| FISCAL-002 | EFD = diagnóstico | Código + UI banners | confirmado | `already_fixed` | banners honestos | e2e smoke | prior |
| PARSER-001 | NFS-e matriz | Relato | capability registry | `implemented` | registry + landing bind + settings | hardening-wave2 | wave |
| PARSER-002 | CNPJ alfanumérico E2E | Helper existe | gaps em exports | `implemented` | `formatCnpj` em CSV/XLSX + teste | hardening-wave3 | wave |
| PARSER-003 | Corpus ZIP/XML malicioso | limits existem | fixtures incompletos | `implemented` | guard unit tests (sem bomb execution) | malicious-corpus | wave |
| REG-001 | Governança → saídas | migrations 005–007 | UI não mostra versões | `implemented` | Settings card runtime versions | — | wave |
| REG-002 | RTC schemas | rtc-observe | sem fixtures | `implemented` | `tests/fixtures/rtc-observe-nfe.xml` | hardening-wave3 | wave |
| CONTENT-001 | Landing overclaim | prior hardening | banners | `already_fixed` | landing ← PARSER_CAPABILITIES | — | wave |
| SAAS-001 | IndexedDB SoT | código | local primary; cloud metadata | `confirmed` | migrate+gate | — | — |
| SAAS-002 | Supabase readiness | prod health supabase:false sem env | gate | `confirmed` | CLOUD_READINESS | — | — |
| SEC-001 | RLS não provada em CI | policies exist | matrix doc only | `partially_confirmed` | rls-hygiene offline | rls-hygiene | wave |
| SEC-003 | Storage/URLs assinadas | local storage | blocked/partial | `blocked_external` | — | — | — |
| SEC-004 | Logs/SQL preview | AI mock | redaction | `implemented` | redaction + AI SQL preview | hardening-wave2 | wave |
| LGPD-001 | Controles operacionais | docs parciais | expandir | `partially_confirmed` | masking settings + redaction | — | — |
| BILLING-001 | Billing não durável | mock in-memory | confirmado | `deferred` | Stripe — depois | — | — |
| BILLING-002 | Entitlements server | usage.ts process-local | confirmado | `partial` | Postgres `usage_counters` quando service role+UUID; Stripe deferred | — | wave |
| AI-001 | IA mock | ENABLE_AI=false | confirmado | `already_fixed` | keep demo badge | — | prior |
| UX-001 | Mocks competem | AI/billing pages | partial | `partially_confirmed` | badges | — | — |
| UX-002 | Contexto multiempresa | selector existe | parcial | `partially_confirmed` | URL sync | — | — |
| UI-001 | Inglês na UI | Quality “Health Score” | confirmado | `implemented` | Qualidade / Índice de saúde | — | wave |
| A11Y-001 | a11y/mobile | smoke parcial | skip link | `partially_confirmed` | skip-link + labels; axe smoke deferred | — | wave |
| TEST-001 | Cenários críticos | 67 unit | gaps | `implemented` | 94+ unit | — | wave |
| PERF-001 | Benchmark volumes | ausente | — | `implemented` | `docs/PERF_BENCHMARK.md` method | — | wave |
| OPS-001 | Release traceability | parcial | version stamp | `implemented` | `src/lib/release.ts` + health/settings | — | wave |
| ARCH-001 | Dupla SoT | IndexedDB+cloud | confirmado | `confirmed` | sync states | — | — |
| FEATURE-001 | Workflow achados | triage parcial | expandir | `implemented` | audit statuses/history | — | wave |
| FEATURE-002 | PVA compare | workflow parcial | expandir | `implemented` | `comparePvaRuns` + UI | hardening-wave3 | wave |
| FEATURE-003 | Reprocess versionado | ausente | — | `implemented` | analysis generations + reprocess | hardening-wave2 | wave |
| HYP-001 | CTA Analisar lote quebrado | hipótese OCR | sem string | `implemented` | CTA dashboard → qualidade | — | wave |
| HYP-002 | Arrays/`text[[` na UI | hipótese | flatten overwrite | `implemented` | indexed keys + no object String() | hardening-wave3 | wave |
