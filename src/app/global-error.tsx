"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold">Falha inesperada</h1>
          <p className="text-sm text-slate-400">
            Recarregue a página. Se persistir, envie o código de diagnóstico do admin ao suporte.
            Digest: {error.digest || "n/a"}
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
