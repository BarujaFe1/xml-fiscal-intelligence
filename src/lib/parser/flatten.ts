import type { InferredType } from "@/types";

export type FlatValue = string | number | boolean | null;

export interface FlatField {
  pathOriginal: string;
  pathNormalized: string;
  fieldName: string;
  value: FlatValue;
  inferredType: InferredType;
  isEmpty: boolean;
}

const ATTR_PREFIX = "@_";

function stripNamespace(key: string): string {
  const cleaned = key.startsWith(ATTR_PREFIX) ? key.slice(ATTR_PREFIX.length) : key;
  const parts = cleaned.split(":");
  return parts[parts.length - 1];
}

function inferType(value: FlatValue): InferredType {
  if (value === null || value === "") return "empty";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      return "date";
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) return "number";
    if (value === "true" || value === "false") return "boolean";
  }
  return "string";
}

function normalizeValue(value: unknown): FlatValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "#text" in (value as object)) {
    return normalizeValue((value as Record<string, unknown>)["#text"]);
  }
  return String(value);
}

/**
 * Flatten any XML-derived object into path → value pairs.
 * Arrays keep indices: det[0].prod.xProd
 */
export function flattenXmlObject(
  obj: unknown,
  prefix = "",
  out: FlatField[] = [],
): FlatField[] {
  if (obj === null || obj === undefined) {
    if (prefix) {
      out.push({
        pathOriginal: prefix,
        pathNormalized: prefix
          .split(".")
          .map((p) => stripNamespace(p.replace(/\[\d+\]/g, "")))
          .join("."),
        fieldName: stripNamespace(prefix.split(".").pop() || prefix),
        value: null,
        inferredType: "empty",
        isEmpty: true,
      });
    }
    return out;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const next = prefix ? `${prefix}[${index}]` : `[${index}]`;
      flattenXmlObject(item, next, out);
    });
    return out;
  }

  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record);
    const hasOnlyText =
      keys.length === 1 && (keys[0] === "#text" || keys[0].startsWith(ATTR_PREFIX));

    if (keys.includes("#text") && keys.every((k) => k === "#text" || k.startsWith(ATTR_PREFIX))) {
      const value = normalizeValue(record["#text"]);
      const inferredType = inferType(value);
      out.push({
        pathOriginal: prefix,
        pathNormalized: prefix
          .split(".")
          .map((p) => stripNamespace(p.replace(/\[\d+\]/g, "")))
          .filter(Boolean)
          .join("."),
        fieldName: stripNamespace((prefix.split(".").pop() || prefix).replace(/\[\d+\]/g, "")),
        value,
        inferredType,
        isEmpty: value === null || value === "",
      });
      for (const key of keys.filter((k) => k.startsWith(ATTR_PREFIX))) {
        const attrPath = prefix ? `${prefix}.${key}` : key;
        const attrValue = normalizeValue(record[key]);
        out.push({
          pathOriginal: attrPath,
          pathNormalized: attrPath
            .split(".")
            .map((p) => stripNamespace(p.replace(/\[\d+\]/g, "")))
            .join("."),
          fieldName: stripNamespace(key),
          value: attrValue,
          inferredType: inferType(attrValue),
          isEmpty: attrValue === null || attrValue === "",
        });
      }
      return out;
    }

    if (hasOnlyText) {
      return flattenXmlObject(record[keys[0]], prefix, out);
    }

    for (const [key, value] of Object.entries(record)) {
      if (key === "?xml") continue;
      const next = prefix ? `${prefix}.${key}` : key;
      flattenXmlObject(value, next, out);
    }
    return out;
  }

  const value = normalizeValue(obj);
  const inferredType = inferType(value);
  out.push({
    pathOriginal: prefix,
    pathNormalized: prefix
      .split(".")
      .map((p) => stripNamespace(p.replace(/\[\d+\]/g, "")))
      .filter(Boolean)
      .join("."),
    fieldName: stripNamespace((prefix.split(".").pop() || prefix).replace(/\[\d+\]/g, "")),
    value,
    inferredType,
    isEmpty: value === null || value === "",
  });
  return out;
}

export function flatFieldsToRecord(fields: FlatField[]): Record<string, FlatValue> {
  const record: Record<string, FlatValue> = {};
  for (const field of fields) {
    record[field.pathNormalized || field.pathOriginal] = field.value;
  }
  return record;
}
