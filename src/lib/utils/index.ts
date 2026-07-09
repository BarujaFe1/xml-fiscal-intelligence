import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function formatCnpjCpf(value?: string | null, mask = true) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 14) {
    const formatted = digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    );
    if (!mask) return formatted;
    return formatted.replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/, "$1.$2.$3/$4-XX");
  }
  if (digits.length === 11) {
    const formatted = digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    if (!mask) return formatted;
    return formatted.replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, "$1.$2.***-**");
  }
  return value;
}

export function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object") return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

export function deepGet(obj: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = obj;
    let ok = true;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
