import Link from "next/link";
import {
  ArrowRight,
  FileCode2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
  BarChart3,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/15">
            <FileCode2 className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-slate-50">XML Fiscal Intelligence</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Plataforma fiscal com rastreabilidade
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:inline text-sm text-slate-400 hover:text-slate-100">
            Entrar
          </Link>
          <Link href="/app" className="hidden sm:inline text-sm text-slate-400 hover:text-slate-100">
            Ver demonstração
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Criar conta <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden grid-bg">
          <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-16">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                NF-e · CT-e · NFS-e · diagnóstico EFD
              </div>
              <h1
                className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-slate-50"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                XML Fiscal Intelligence
              </h1>
              <p className="mt-5 text-lg md:text-xl text-slate-300 max-w-2xl">
                Organize, audite e prepare seus documentos fiscais com rastreabilidade.
              </p>
              <p className="mt-3 text-slate-400 max-w-2xl">
                Transforme ZIPs em dados pesquisáveis, encontre inconsistências, compare competências,
                gere relatórios e acompanhe a prontidão da EFD ICMS/IPI — sem alegar conformidade
                automática nem substituir o contador.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400"
                >
                  Criar conta
                </Link>
                <Link
                  href="/app/upload"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm text-slate-200 hover:bg-white/5"
                >
                  <Upload className="h-4 w-4" /> Ver demonstração (local)
                </Link>
              </div>
              <p className="mt-3 text-xs text-slate-500 max-w-xl">
                A demonstração local processa o ZIP neste navegador (IndexedDB). Não é armazenamento em
                nuvem até o workspace SaaS estar configurado.
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "ZIP → dados pesquisáveis",
                  desc: "Extração segura, flatten de tags e tabelas de documentos/itens.",
                  icon: Lock,
                },
                {
                  title: "Auditoria com rastreio",
                  desc: "Achados versionáveis, agrupamento de ruído e revisão humana.",
                  icon: Table2,
                },
                {
                  title: "Diagnóstico EFD",
                  desc: "Pré-validação interna e prontidão — conferência no PVA continua obrigatória.",
                  icon: BarChart3,
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                  <item.icon className="h-5 w-5 text-sky-300 mb-3" />
                  <h3 className="font-semibold text-slate-50">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            Como funciona
          </h2>
          <p className="mt-3 max-w-3xl text-slate-400">
            Fluxo assistido a partir do ZIP fiscal — não é “SPED com um clique”, nem garantia contra
            multas.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {["Importar ZIP", "Auditar", "Exportar", "Diagnóstico EFD"].map((step, i) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-xs text-sky-300 mb-2">0{i + 1}</div>
                <div className="font-medium text-slate-100">{step}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-10">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
            Tipos suportados
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { t: "NF-e / NFC-e", d: "nfeProc, itens, impostos, protocolo — CNPJ numérico e alfanumérico." },
              { t: "CT-e", d: "Prestação, carga, tomador, documentos vinculados." },
              { t: "NFS-e", d: "Best-effort municipal; status explícito quando o schema for desconhecido." },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-5">
                <div className="font-semibold text-emerald-200">{x.t}</div>
                <p className="mt-2 text-sm text-slate-400">{x.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
                  Segurança e honestidade funcional
                </h2>
                <p className="mt-2 text-slate-400 max-w-xl">
                  XMLs reais fora do Git. Sem scraping SEFAZ. Sem armazenamento improvisado de
                  certificado. IA e billing em demonstração até configuração real.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                Privacidade · RLS preparado · PVA obrigatório
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-6">
            <div>
              <div className="font-semibold text-slate-50">Comece com conta ou demonstração local</div>
              <div className="text-sm text-slate-400">
                Conta SaaS exige Supabase configurado. Demonstração local usa IndexedDB neste navegador.
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950"
              >
                Criar conta
              </Link>
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm text-slate-200"
              >
                <Search className="h-4 w-4" /> Ver demonstração
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
