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
 * Prefer ide/mod from the parsed tree (canonical). Falls back to raw heuristics.
 * Model 55 → NFE, model 65 → NFCE. Never classify mod=55 as NFCE.
 */
export function extractIdeMod(parsed: unknown): string | undefined {
  const found = findFirstByLocalName(parsed, "mod", 0, 12);
  if (found === undefined || found === null) return undefined;
  if (typeof found === "object" && found !== null && "#text" in (found as object)) {
    return String((found as { "#text": unknown })["#text"]).trim();
  }
  const s = String(found).trim();
  return s || undefined;
}

function findFirstByLocalName(
  obj: unknown,
  localName: string,
  depth: number,
  maxDepth: number,
): unknown {
  if (!obj || typeof obj !== "object" || depth > maxDepth) return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const hit = findFirstByLocalName(item, localName, depth + 1, maxDepth);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const clean = (k.includes(":") ? k.split(":").pop()! : k).toLowerCase();
    if (clean === localName.toLowerCase()) return v;
    // Prefer ide.mod by descending into ide first when present
    if (clean === "ide") {
      const inIde = findFirstByLocalName(v, localName, depth + 1, maxDepth);
      if (inIde !== undefined) return inIde;
    }
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const clean = (k.includes(":") ? k.split(":").pop()! : k).toLowerCase();
    if (clean === "ide") continue;
    const hit = findFirstByLocalName(v, localName, depth + 1, maxDepth);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * Detect fiscal document family from parsed XML object and/or raw string.
 * For NF-e family, `ide/mod` prevails over loose raw heuristics.
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

  // NF-e family: model from ide/mod prevails
  if (nfeScore >= cteScore && nfeScore >= nfseScore && nfeScore > 0) {
    const mod = extractIdeMod(parsed);
    if (mod === "65") return "NFCE";
    if (mod === "55") return "NFE";
    // Fallback heuristics only when mod absent
    if (hasAny(raw, ["<mod>65</mod>", "nfc-e", "nfce"])) return "NFCE";
    // Avoid treating bare ">65<" as decisive when mod=55 may exist elsewhere
    if (!mod && hasAny(raw, [">65<"])) return "NFCE";
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
  if (max === nfeScore) {
    const mod = extractIdeMod(parsed);
    if (mod === "65") return "NFCE";
    return "NFE";
  }
  if (max === cteScore) return "CTE";
  if (max === nfseScore) return "NFSE";
  return "UNKNOWN";
}
