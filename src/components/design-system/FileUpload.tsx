"use client";

import { cn } from "@/lib/utils";
import { UploadCloud } from "lucide-react";
import { useId, useRef, useState } from "react";
import { FormField } from "./FormField";

// Upload de arquivo acessível: rótulo visível, nome acessível, sem
// "Choose File / No file chosen" (prompt §11.7).
export function FileUpload({
  label,
  accept,
  multiple,
  onChange,
  hint,
  error,
  required,
  className,
}: {
  label: string;
  accept?: string;
  multiple?: boolean;
  onChange: (files: FileList | null) => void;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");

  return (
    <FormField id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            setFileName(multiple ? `${files.length} arquivo(s)` : files[0].name);
          } else {
            setFileName("");
          }
          onChange(files);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 bg-slate-950 px-4 py-4 text-left text-sm text-slate-300 transition-colors hover:border-sky-400/40 hover:bg-white/5",
          error && "border-rose-400/60",
        )}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <UploadCloud className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block font-medium text-slate-100">
            {fileName || "Selecionar arquivo"}
          </span>
          {!fileName && (
            <span className="block text-xs text-slate-300">Clique para escolher do dispositivo</span>
          )}
        </span>
      </button>
    </FormField>
  );
}
