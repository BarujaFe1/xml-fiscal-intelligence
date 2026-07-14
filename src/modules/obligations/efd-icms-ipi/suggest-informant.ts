import type { DocumentSummary } from "@/types";

function onlyDigits(v?: string) {
  return (v || "").replace(/\D/g, "");
}
const IBGE_UF: Record<string, string> = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

/** CNPJ do emitente embutido na chave NF-e (posições 7–20, 1-based). */
export function cnpjFromAccessKey(accessKey?: string): string {
  const k = onlyDigits(accessKey);
  return k.length >= 20 ? k.slice(6, 20) : "";
}

export function ufFromAccessKey(accessKey?: string): string | undefined {
  const k = onlyDigits(accessKey);
  if (k.length < 2) return undefined;
  return IBGE_UF[k.slice(0, 2)];
}

export type InformantSuggestion = {
  cnpj: string;
  uf?: string;
  name?: string;
  ie?: string;
  codMun?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  cep?: string;
  count: number;
  distinctEmitters: number;
};

/**
 * Sugere o informante (0000) a partir do emitente mais frequente no lote.
 * Evita misturar CNPJ demo com NF-e reais (erro PVA de chave × informante).
 */
export function suggestInformantFromDocuments(
  documents: DocumentSummary[],
): InformantSuggestion | null {
  const counts = new Map<
    string,
    { n: number; sample?: DocumentSummary; uf?: string }
  >();
  for (const d of documents) {
    if (!(d.documentType === "NFE" || d.documentType === "NFCE" || d.model === "55")) {
      continue;
    }
    const cnpj = onlyDigits(d.emitterDoc) || cnpjFromAccessKey(d.accessKey);
    if (cnpj.length !== 14) continue;
    const cur = counts.get(cnpj) || {
      n: 0,
      sample: d,
      uf: d.emitterUf || ufFromAccessKey(d.accessKey),
    };
    cur.n += 1;
    if (!cur.sample) cur.sample = d;
    if (!cur.uf) cur.uf = d.emitterUf || ufFromAccessKey(d.accessKey);
    counts.set(cnpj, cur);
  }
  let best: { cnpj: string; n: number; sample?: DocumentSummary; uf?: string } | null =
    null;
  for (const [cnpj, v] of counts) {
    if (!best || v.n > best.n) best = { cnpj, ...v };
  }
  if (!best) return null;
  const s = best.sample;
  return {
    cnpj: best.cnpj,
    uf: best.uf || s?.emitterUf,
    name: s?.emitterName,
    ie: s?.emitterIe,
    codMun: s?.emitterCityCode,
    address: s?.emitterAddress,
    addressNumber: s?.emitterAddressNumber,
    neighborhood: s?.emitterNeighborhood,
    cep: s?.emitterCep,
    count: best.n,
    distinctEmitters: counts.size,
  };
}

/** Enrich establishment fields from a specific emitter CNPJ present in the batch. */
export function suggestInformantByCnpj(
  documents: DocumentSummary[],
  cnpjRaw: string,
): InformantSuggestion | null {
  const want = onlyDigits(cnpjRaw);
  if (want.length !== 14) return null;
  let count = 0;
  let sample: DocumentSummary | undefined;
  let uf: string | undefined;
  const all = new Set<string>();
  for (const d of documents) {
    if (!(d.documentType === "NFE" || d.documentType === "NFCE" || d.model === "55")) {
      continue;
    }
    const cnpj = onlyDigits(d.emitterDoc) || cnpjFromAccessKey(d.accessKey);
    if (cnpj.length !== 14) continue;
    all.add(cnpj);
    if (cnpj !== want) continue;
    count += 1;
    if (!sample) sample = d;
    if (!uf) uf = d.emitterUf || ufFromAccessKey(d.accessKey);
  }
  if (!count || !sample) return null;
  return {
    cnpj: want,
    uf: uf || sample.emitterUf,
    name: sample.emitterName,
    ie: sample.emitterIe,
    codMun: sample.emitterCityCode,
    address: sample.emitterAddress,
    addressNumber: sample.emitterAddressNumber,
    neighborhood: sample.emitterNeighborhood,
    cep: sample.emitterCep,
    count,
    distinctEmitters: all.size,
  };
}
