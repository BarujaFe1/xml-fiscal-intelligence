/**
 * Decode XML/HTML entities exactly once for human-facing exports.
 */
export function decodeXmlEntitiesOnce(input: string): string {
  if (!input || !input.includes("&")) return input;
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export function sanitizeHumanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return decodeXmlEntitiesOnce(String(value));
}
