const KEY = "xfi:last-company-cnpj";

export function getLastCompanyCnpj(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const v = localStorage.getItem(KEY);
    return v && v.replace(/\D/g, "").length >= 11 ? v.replace(/\D/g, "") : null;
  } catch {
    return null;
  }
}

export function setLastCompanyCnpj(cnpj: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const d = cnpj.replace(/\D/g, "");
    if (d) localStorage.setItem(KEY, d);
  } catch {
    // ignore quota / private mode
  }
}
