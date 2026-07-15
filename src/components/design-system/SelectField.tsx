import { cn } from "@/lib/utils";
import { FormField } from "./FormField";

// Select acessível com label visível e nome acessível (corrige violation
// crítica em /app/reconciliation, prompt §12).
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  error,
  required,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <FormField id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        id={id}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-[16px] text-slate-100",
          "focus:outline-none focus:ring-2 focus:ring-sky-400",
          error && "border-rose-400/60",
        )}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
