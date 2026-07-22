import { AlertTriangle } from "lucide-react";

export function ErrorState({
  title = "Algo deu errado",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/5 px-6 py-12 text-center"
    >
      <AlertTriangle className="mb-3 h-7 w-7 text-rose-300" aria-hidden="true" />
      <h2 className="text-base font-semibold text-rose-100">{title}</h2>
      {message && <p className="mt-2 max-w-md text-sm text-rose-200/80">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
