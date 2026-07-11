"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-xl font-bold text-slate-50">Algo falhou nesta área</h1>
      <p className="text-sm text-slate-400">
        O erro foi isolado. Nenhum XML é exibido aqui. Código:{" "}
        <code className="text-sky-300">{error.digest || "local"}</code>
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950"
      >
        Tentar novamente
      </button>
    </div>
  );
}
