import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-slate-300">
      <h1 className="text-3xl font-bold text-slate-50" style={{ fontFamily: "var(--font-display), sans-serif" }}>
        Termos de uso
      </h1>
      <p className="text-sm text-amber-200/90 border border-amber-500/20 rounded-xl px-3 py-2 bg-amber-500/5">
        Texto modelo sujeito a revisão jurídica. Não constitui parecer legal final.
      </p>
      <p>
        O XML Fiscal Intelligence é uma ferramenta de organização, auditoria assistida e diagnóstico
        de prontidão fiscal. Não substitui o contador, o PVA oficial nem declara conformidade
        automática perante a Receita Federal ou SEFAZ.
      </p>
      <p>
        O usuário é responsável pela veracidade dos XMLs importados, pela revisão humana dos achados
        e por qualquer transmissão de obrigações acessórias.
      </p>
      <Link href="/" className="text-sky-300">
        Voltar
      </Link>
    </div>
  );
}
