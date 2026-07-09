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
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Data lab fiscal</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/app/batches" className="hidden sm:inline text-sm text-slate-400 hover:text-slate-100">
            Abrir app
          </Link>
          <Link
            href="/app/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Analisar lote <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden grid-bg">
          <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-16">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                NF-e · CT-e · NFS-e · ZIP → inteligência
              </div>
              <h1
                className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-slate-50"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                XML Fiscal Intelligence
              </h1>
              <p className="mt-5 text-lg md:text-xl text-slate-300 max-w-2xl">
                Transforme lotes de XML fiscal em inteligência de dados.
              </p>
              <p className="mt-3 text-slate-400 max-w-2xl">
                Envie um ZIP com NF-e, CT-e e NFS-e. O sistema lê as tags, cria planilhas, permite busca
                avançada e gera análises fiscais em minutos.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/app/upload"
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400"
                >
                  <Upload className="h-4 w-4" /> Analisar lote
                </Link>
                <Link
                  href="/app"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm text-slate-200 hover:bg-white/5"
                >
                  Ver dashboard
                </Link>
              </div>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[
                { title: "Upload seguro de ZIP", desc: "Extração com proteção contra zip slip e XMLs malformados isolados.", icon: Lock },
                { title: "Todas as tags em colunas", desc: "Flatten completo + tabelas de documentos, itens e campos.", icon: Table2 },
                { title: "Data Quality & Insights", desc: "Health score, alertas, top CFOP/NCM/CNPJ e exportações Excel.", icon: BarChart3 },
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
            O problema real
          </h2>
          <p className="mt-3 max-w-3xl text-slate-400">
            Depois de baixar ZIPs no cofre SIEG por CNPJ/mês, o trabalho manual — extrair, classificar,
            abrir tags, lidar com múltiplos itens e consolidar análises — é lento e frágil. Este produto
            automatiza esse fluxo a partir do ZIP.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {["Baixar ZIP", "Detectar tipo", "Achatar tags", "Analisar & exportar"].map((step, i) => (
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
              { t: "NF-e / NFC-e", d: "nfeProc, itens det[], impostos, protocolo, totais." },
              { t: "CT-e", d: "Prestação, carga, tomador, documentos vinculados." },
              { t: "NFS-e", d: "ABRASF e variações municipais com parser resiliente." },
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
                  Privacidade fiscal primeiro
                </h2>
                <p className="mt-2 text-slate-400 max-w-xl">
                  XMLs reais nunca vão para o GitHub. Mascaramento de CNPJ/CPF, pasta private-test-data no
                  .gitignore e modo demo com samples anonimizados.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                Sem scraping · Sem certificado · Só ZIP local
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-6">
            <div>
              <div className="font-semibold text-slate-50">Pronto para o seu lote do mês</div>
              <div className="text-sm text-slate-400">Upload → dashboard → busca → Excel em um fluxo.</div>
            </div>
            <Link
              href="/app/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              <Search className="h-4 w-4" /> Começar agora
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
