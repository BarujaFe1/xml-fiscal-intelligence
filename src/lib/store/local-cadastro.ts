/**
 * Local cadastro store (IndexedDB) until SaaS Postgres is wired.
 * Schema is schemaless — new optional fields appear on upsert; old records still load.
 */

const DB = "xfi_cadastro_v1";
const DB_VERSION = 2;
const CO = "companies";
const EST = "establishments";

export type CompanySource = "manual" | "sieg-pdf" | "xml-lote" | "merged" | "form";

export type LocalCompany = {
  id: string;
  name: string;
  /** Digits (or alphanumeric CNPJ) — prefer CNPJ for obrigações. */
  cnpj?: string;
  kind?: "cnpj" | "cpf";
  tradeName?: string;
  ie?: string;
  uf?: string;
  codMun?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressCompl?: string;
  neighborhood?: string;
  phone?: string;
  email?: string;
  accountantName?: string;
  accountantCpf?: string;
  accountantCrc?: string;
  source?: CompanySource;
  createdAt: string;
  updatedAt?: string;
};

export type LocalEstablishment = {
  id: string;
  companyId: string;
  name: string;
  ie?: string;
  uf: string;
  codMun?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  createdAt: string;
  updatedAt?: string;
};

/** Fiscal fields that can fill obligation forms (without period/profile). */
export type CompanyFiscalPatch = {
  companyName?: string;
  cnpj?: string;
  ie?: string;
  uf?: string;
  codMun?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressCompl?: string;
  neighborhood?: string;
  tradeName?: string;
  phone?: string;
  email?: string;
  accountantName?: string;
  accountantCpf?: string;
  accountantCrc?: string;
};

function onlyDigits(v?: string) {
  return (v || "").replace(/\D/g, "");
}

export function companyDocKey(cnpj?: string): string {
  return onlyDigits(cnpj);
}

/** Prefer non-empty incoming; never invent — empty string clears only when clearEmpty=true. */
export function mergeCompanyFields(
  base: LocalCompany,
  patch: Partial<LocalCompany>,
  opts?: { clearEmpty?: boolean },
): LocalCompany {
  const next: LocalCompany = { ...base };
  const keys = [
    "name",
    "cnpj",
    "kind",
    "tradeName",
    "ie",
    "uf",
    "codMun",
    "cep",
    "address",
    "addressNumber",
    "addressCompl",
    "neighborhood",
    "phone",
    "email",
    "accountantName",
    "accountantCpf",
    "accountantCrc",
    "source",
  ] as const;
  for (const k of keys) {
    const v = patch[k];
    if (v === undefined) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (!t) {
        if (opts?.clearEmpty) (next as Record<string, unknown>)[k] = undefined;
        continue;
      }
      (next as Record<string, unknown>)[k] = t;
    } else {
      (next as Record<string, unknown>)[k] = v;
    }
  }
  next.updatedAt = new Date().toISOString();
  if (patch.source && base.source && patch.source !== base.source && base.source !== "merged") {
    next.source = "merged";
  } else if (patch.source) {
    next.source = patch.source;
  }
  return next;
}

export function localCompanyToFiscalPatch(
  c: LocalCompany,
  est?: LocalEstablishment | null,
): CompanyFiscalPatch {
  return {
    companyName: c.name,
    cnpj: c.cnpj,
    ie: est?.ie || c.ie,
    uf: est?.uf || c.uf,
    codMun: est?.codMun || c.codMun,
    cep: est?.cep || c.cep,
    address: est?.address || c.address,
    addressNumber: est?.addressNumber || c.addressNumber,
    neighborhood: est?.neighborhood || c.neighborhood,
    tradeName: c.tradeName,
    phone: c.phone,
    email: c.email,
    accountantName: c.accountantName,
    accountantCpf: c.accountantCpf,
    accountantCrc: c.accountantCrc,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CO)) db.createObjectStore(CO, { keyPath: "id" });
      if (!db.objectStoreNames.contains(EST)) db.createObjectStore(EST, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function put(store: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function del(store: string, id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function listCompanies() {
  return getAll<LocalCompany>(CO);
}

export function saveCompany(c: LocalCompany) {
  const now = new Date().toISOString();
  return put(CO, {
    ...c,
    updatedAt: c.updatedAt || now,
    createdAt: c.createdAt || now,
  });
}

export async function getCompanyByCnpj(cnpjRaw: string): Promise<LocalCompany | null> {
  const want = companyDocKey(cnpjRaw);
  if (!want) return null;
  const all = await listCompanies();
  return all.find((c) => companyDocKey(c.cnpj) === want) || null;
}

/**
 * Insert or merge by CNPJ (or CPF digits). Returns the saved company.
 */
export async function upsertCompanyByCnpj(
  patch: Partial<LocalCompany> & { name: string; cnpj: string },
): Promise<LocalCompany> {
  const doc = companyDocKey(patch.cnpj);
  const existing = doc ? await getCompanyByCnpj(doc) : null;
  const now = new Date().toISOString();
  const kind =
    patch.kind ||
    (doc.length === 14 ? "cnpj" : doc.length === 11 ? "cpf" : existing?.kind) ||
    "cnpj";
  const base: LocalCompany = existing || {
    id: crypto.randomUUID(),
    name: patch.name,
    cnpj: doc || patch.cnpj,
    kind,
    createdAt: now,
    source: patch.source || "manual",
  };
  const merged = mergeCompanyFields(base, {
    ...patch,
    cnpj: doc || patch.cnpj,
    kind,
    name: patch.name || base.name,
  });
  await saveCompany(merged);
  return merged;
}

export async function upsertCompaniesBulk(
  entries: Array<Partial<LocalCompany> & { name: string; cnpj: string }>,
): Promise<{ saved: number; updated: number }> {
  let saved = 0;
  let updated = 0;
  for (const e of entries) {
    const before = await getCompanyByCnpj(e.cnpj);
    await upsertCompanyByCnpj(e);
    if (before) updated += 1;
    else saved += 1;
  }
  return { saved, updated };
}

export async function deleteCompany(id: string): Promise<void> {
  const ests = await listEstablishments();
  for (const e of ests.filter((x) => x.companyId === id)) {
    await del(EST, e.id);
  }
  await del(CO, id);
}

export function listEstablishments() {
  return getAll<LocalEstablishment>(EST);
}

export function saveEstablishment(e: LocalEstablishment) {
  const now = new Date().toISOString();
  return put(EST, {
    ...e,
    updatedAt: e.updatedAt || now,
    createdAt: e.createdAt || now,
  });
}

export async function deleteEstablishment(id: string): Promise<void> {
  await del(EST, id);
}

export async function ensureDefaultEstablishment(
  company: LocalCompany,
): Promise<LocalEstablishment> {
  const all = await listEstablishments();
  const existing = all.find((e) => e.companyId === company.id);
  if (existing) {
    const merged: LocalEstablishment = {
      ...existing,
      ie: company.ie || existing.ie,
      uf: (company.uf || existing.uf || "SP").slice(0, 2).toUpperCase(),
      codMun: company.codMun || existing.codMun,
      cep: company.cep || existing.cep,
      address: company.address || existing.address,
      addressNumber: company.addressNumber || existing.addressNumber,
      neighborhood: company.neighborhood || existing.neighborhood,
      updatedAt: new Date().toISOString(),
    };
    await saveEstablishment(merged);
    return merged;
  }
  const created: LocalEstablishment = {
    id: crypto.randomUUID(),
    companyId: company.id,
    name: "Matriz",
    ie: company.ie,
    uf: (company.uf || "SP").slice(0, 2).toUpperCase(),
    codMun: company.codMun,
    cep: company.cep,
    address: company.address,
    addressNumber: company.addressNumber,
    neighborhood: company.neighborhood,
    createdAt: new Date().toISOString(),
  };
  await saveEstablishment(created);
  return created;
}
