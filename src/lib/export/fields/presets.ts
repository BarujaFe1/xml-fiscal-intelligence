import type { ExportFieldPreset } from "@/lib/export/fields/types";
import { buildDefaultPreset } from "@/lib/export/fields/defaults";

const STORAGE_KEY = "xfi:export-field-presets:v1";

export function loadFieldPresets(): ExportFieldPreset[] {
  if (typeof window === "undefined") return [buildDefaultPreset()];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [buildDefaultPreset()];
    const parsed = JSON.parse(raw) as ExportFieldPreset[];
    if (!Array.isArray(parsed) || !parsed.length) return [buildDefaultPreset()];
    return parsed;
  } catch {
    return [buildDefaultPreset()];
  }
}

export function saveFieldPresets(presets: ExportFieldPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function upsertPreset(preset: ExportFieldPreset, all: ExportFieldPreset[]): ExportFieldPreset[] {
  const next = all.filter((p) => p.id !== preset.id);
  next.push({ ...preset, updatedAt: new Date().toISOString() });
  saveFieldPresets(next);
  return next;
}

export function deletePreset(id: string, all: ExportFieldPreset[]): ExportFieldPreset[] {
  if (id === "preset_default_13") return all;
  const next = all.filter((p) => p.id !== id);
  saveFieldPresets(next.length ? next : [buildDefaultPreset()]);
  return next.length ? next : [buildDefaultPreset()];
}

export function exportPresetJson(preset: ExportFieldPreset): string {
  return JSON.stringify(preset, null, 2);
}

export function importPresetJson(raw: string): ExportFieldPreset {
  const parsed = JSON.parse(raw) as ExportFieldPreset;
  if (!parsed || parsed.schemaVersion !== "1.0.0" || !Array.isArray(parsed.columns)) {
    throw new Error("Preset inválido: schemaVersion 1.0.0 e columns são obrigatórios");
  }
  return {
    ...parsed,
    id: parsed.id || `preset_${Date.now().toString(36)}`,
    updatedAt: new Date().toISOString(),
  };
}
