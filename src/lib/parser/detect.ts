import type { DocumentType } from "@/types";

function hasAny(haystack: string, needles: string[]) {
  return needles.some((n) => haystack.includes(n.toLowerCase()));
}

function collectKeys(obj: unknown, keys = new Set<string>(), depth = 0): Set<string> {
  if (!obj || typeof obj !== "object" || depth > 8) return keys;
  if (Array.isArray(obj)) {
    for (const item of obj.slice(0, 20)) collectKeys(item, keys, depth + 1);
    return keys;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const clean = k.includes(":") ? k.split(":").pop()! : k;
    keys.add(clean.toLowerCase());
    collectKeys(v, keys, depth + 1);
  }
  return keys;
}

/**
 * Detect fiscal document family from parsed XML object and/or raw string.
 */
export function detectDocumentType(parsed: unknown, rawXml = ""): DocumentType {
  const raw = rawXml.toLowerCase();
  const keys = collectKeys(parsed);
  const keyStr = [...keys].join(" ");

  // Events / cancel / CC-e first (more specific)
  if (
    keys.has("proceventonfe") ||
    keys.has("eventonfe") ||
    keys.has("infevento") ||
    hasAny(raw, ["proceventonfe", "eventonfe", "retEvento".toLowerCase()])
  ) {
    if (hasAny(raw, ["cancelamento", "110111", "tpEvento>110111".toLowerCase()])) {
      return "CANCELATION";
    }
    if (hasAny(raw, ["cartadecorrecao", "110110", "cce"])) {
      return "CORRECTION_LETTER";
    }
    return "EVENT";
  }

  const nfeSignals = ["nfeproc", "nfe", "infnfe", "protnfe", "ide", "det"];
  const cteSignals = ["cteproc", "cte", "infcte", "protcte", "vprest", "infcarga"];
  const nfseSignals = [
    "compnfse",
    "nfse",
    "infnfse",
    "declaracaoprestacaoservico",
    "infdeclaracaoprestacaoservico",
    "prestadorservico",
    "tomadorservico",
    "valoresnfse",
    "listanfse",
    "rps",
  ];

  const score = (signals: string[]) =>
    signals.reduce((acc, s) => acc + (keys.has(s) || keyStr.includes(s) || raw.includes(s) ? 1 : 0), 0);

  const nfeScore = score(nfeSignals) + (hasAny(raw, ["nfeproc", "<nfe", "infnfe"]) ? 2 : 0);
  const cteScore = score(cteSignals) + (hasAny(raw, ["cteproc", "<cte", "infcte"]) ? 2 : 0);
  const nfseScore =
    score(nfseSignals) +
    (hasAny(raw, ["compnfse", "infnfse", "prestadorservico", "abrasf"]) ? 2 : 0);

  // NFC-e: model 65
  if (nfeScore >= cteScore && nfeScore >= nfseScore && nfeScore > 0) {
    if (hasAny(raw, [">65<", "<mod>65</mod>", "nfc-e", "nfce"])) return "NFCE";
    return "NFE";
  }
  if (keys.has("cteproc") || keys.has("cte")) {
    if (cteScore >= nfeScore && cteScore >= nfseScore) return "CTE";
  }
  if (keys.has("compnfse") || keys.has("nfse") || keys.has("infnfse")) {
    if (nfseScore >= nfeScore && nfseScore >= cteScore) return "NFSE";
  }

  const max = Math.max(nfeScore, cteScore, nfseScore);
  if (max === 0) return "UNKNOWN";
  if (max === nfeScore) return "NFE";
  if (max === cteScore) return "CTE";
  if (max === nfseScore) return "NFSE";
  return "UNKNOWN";
}
