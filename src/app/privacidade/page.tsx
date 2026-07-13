import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-slate-300">
      <h1 className="text-3xl font-bold text-slate-50" style={{ fontFamily: "var(--font-display), sans-serif" }}>
        Política de privacidade
      </h1>
      <p className="text-sm text-amber-200/90 border border-amber-500/20 rounded-xl px-3 py-2 bg-amber-500/5">
        Texto modelo sujeito a revisão jurídica (LGPD). Ver também docs/LGPD_DATA_MAP.md.
      </p>
      <p>
        Em modo local, documentos fiscais permanecem no navegador (IndexedDB). Em modo SaaS, dados
        são segregados por workspace com RLS. XML bruto não deve ser enviado a provedores de IA sem
        consentimento e mascaramento.
      </p>
      <p>
        Contato do encarregado (lab/MVP): atualizar e-mail institucional antes de qualquer
        oferta comercial. Enquanto isso, trate lotes como dados sensíveis e use apenas samples
        anonimizados em demos públicas.
      </p>
      <Link href="/" className="text-sky-300">
        Voltar
      </Link>
    </div>
  );
}
