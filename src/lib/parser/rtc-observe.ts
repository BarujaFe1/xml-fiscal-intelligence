/**
 * RTC (Reforma Tributária do Consumo) tag detection — observation only.
 * Does not invent CBS/IBS/IS amounts or claim conformity.
 */

const RTC_HINT_RE =
  /\b(CBS|IBS|IS|IBSCBS|impostoSeletivo|gIBS|gCBS|gIS|vIBS|vCBS|vIS)\b/i;

export interface RtcObservation {
  hasRtcHints: boolean;
  matchedKeys: string[];
  note: string;
}

/** Scan flattened JSON keys / raw XML for transitional RTC tag names. */
export function observeRtcTags(input: {
  flattenedKeys?: string[];
  rawXml?: string;
}): RtcObservation {
  const matched = new Set<string>();
  for (const key of input.flattenedKeys || []) {
    if (RTC_HINT_RE.test(key)) matched.add(key);
  }
  if (input.rawXml && RTC_HINT_RE.test(input.rawXml)) {
    matched.add("(raw-xml-hint)");
  }
  const matchedKeys = [...matched].slice(0, 40);
  return {
    hasRtcHints: matchedKeys.length > 0,
    matchedKeys,
    note: matchedKeys.length
      ? "Tags/caminhos possivelmente relacionados à RTC detectados. Preservados no flatten; não interpretados como conformidade nem incluídos na EFD ICMS/IPI sem regra oficial aplicável."
      : "Nenhum hint CBS/IBS/IS detectado neste documento.",
  };
}
