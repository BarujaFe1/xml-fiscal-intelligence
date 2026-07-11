# Audit Findings Resolution

**Branch:** `feat/enterprise-production-hardening`  
**Method:** reproduce from code → classify → fix → regression test.

| ID | Achado | Evidência recebida | Reprodução | Estado | Correção | Teste de regressão | Commit |
| -- | ------ | ------------------ | ---------- | ------ | -------- | ------------------ | ------ |
| DATA-001 | Score premia lote sem docs avaliados | Auditoria: 1147 XMLs todos conhecidos → score 80 “saudável” | `documents.length\|\|1` + dims em 100 com amostra 0 | `verified` | MetricEvaluation; score null se não avaliado; UI PT-BR | `tests/unit/quality-score.test.ts` | TBD |
| DATA-002 | Incremental sem linhagem de reutilizados | Relato | skip só em importLogs; sem ReusedDocumentReference | `confirmed` | pending | — | — |
| DATA-003 | Métricas 0/0 confundem | Relato | mesmo root cause DATA-001 | `verified` | coberto com DATA-001 | quality-score | TBD |
| DATA-004 | Logs exportam IDs completos | Relato | revisar export de logs | `pending` | — | — | — |
| EXPORT-001 | JSON vazio não autodescritivo | Relato | bare store JSON | `implemented` | ExportEnvelope + emptyReason | export-manifest.test | TBD |
| EXPORT-002 | CSV só cabeçalho | Relato | headers only | `implemented` | BOM + meta comments | export-manifest.test | TBD |
| EXPORT-003 | XLSX “Sem dados” | Relato | addSheet Sem dados | `implemented` | empty meta row | — | TBD |
| EXPORT-004 | Falta manifesto transversal | Relato | — | `implemented` | GenerationManifest | export-manifest.test | TBD |
| EXPORT-005 | HTML impressão | Relato | — | `implemented` | viewport + @media print | — | TBD |
| SEC-002 | Headers segurança | next.config | missing | `implemented` | CSP/HSTS/etc in next.config.ts | build | TBD |
| FISCAL-001 | Sem protocolo / ruído | Código: collapse ≥60% | partial fix já em master | `partially_confirmed` | elegibilidade isProtocolRequired | TBD | — |
| FISCAL-002 | EFD = diagnóstico | Código + UI banners | confirmado | `already_fixed` | banners honestos | e2e smoke | prior |
| PARSER-001 | NFS-e matriz | Relato | capability registry ausente | `confirmed` | pending | — | — |
| PARSER-002 | CNPJ alfanumérico E2E | Helper existe | gaps em masks/exports | `partially_confirmed` | pending | — | — |
| PARSER-003 | Corpus ZIP/XML malicioso | limits existem | fixtures incompletos | `partially_confirmed` | pending | — | — |
| REG-001 | Governança → saídas | migrations 005–007 | UI não mostra versões | `partially_confirmed` | pending | — | — |
| REG-002 | RTC schemas | rtc-observe | sem fixtures oficiais | `partially_confirmed` | pending | — | — |
| CONTENT-001 | Landing overclaim | prior hardening | banners | `already_fixed` | review contínuo | — | prior |
| SAAS-001 | IndexedDB SoT | código | local primary; cloud metadata | `confirmed` | migrate+gate | — | — |
| SAAS-002 | Supabase readiness | prod health supabase:false sem env | gate | `confirmed` | CLOUD_READINESS | — | — |
| SEC-001 | RLS não provada em CI | policies exist | matrix doc only | `partially_confirmed` | RLS tests | — | — |
| SEC-003 | Storage/URLs assinadas | local storage | blocked/partial | `blocked_external` | — | — | — |
| SEC-004 | Logs/SQL preview | AI mock | pending redaction | `pending` | — | — | — |
| LGPD-001 | Controles operacionais | docs parciais | expandir | `partially_confirmed` | docs+UI | — | — |
| BILLING-001 | Billing não durável | mock in-memory | confirmado | `confirmed` | Stripe durable | blocked keys | — |
| BILLING-002 | Entitlements server | usage.ts process-local | confirmado | `confirmed` | pending Postgres | — | — |
| AI-001 | IA mock | ENABLE_AI=false | confirmado | `already_fixed` | keep demo badge | — | prior |
| UX-001 | Mocks competem | AI/billing pages | partial | `partially_confirmed` | badges | — | — |
| UX-002 | Contexto multiempresa | selector existe | parcial | `partially_confirmed` | URL sync | — | — |
| UI-001 | Inglês na UI | Quality “Health Score” | confirmado | `confirmed` | PT-BR | — | — |
| A11Y-001 | a11y/mobile | smoke parcial | pending axe | `pending` | — | — | — |
| TEST-001 | Cenários críticos | 67 unit | gaps | `confirmed` | expandir | — | — |
| PERF-001 | Benchmark volumes | ausente | — | `pending` | — | — | — |
| OPS-001 | Release traceability | parcial | version stamp | `pending` | — | — | — |
| ARCH-001 | Dupla SoT | IndexedDB+cloud | confirmado | `confirmed` | sync states | — | — |
| FEATURE-001 | Workflow achados | triage parcial | expandir | `pending` | — | — | — |
| FEATURE-002 | PVA compare | workflow parcial | expandir | `partially_confirmed` | — | — | — |
| FEATURE-003 | Reprocess versionado | ausente | — | `pending` | — | — | — |
| HYP-001 | CTA Analisar lote quebrado | hipótese OCR | reproduzir | `pending` | — | — | — |
| HYP-002 | Arrays/`text[[` na UI | hipótese | reproduzir | `pending` | — | — | — |
