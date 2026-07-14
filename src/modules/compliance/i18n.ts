/**
 * i18n scaffold — pt-BR default + en. Sem engines fiscais estrangeiros.
 */

import type { LocaleCode } from "@/modules/compliance/types";

const MESSAGES = {
  "pt-BR": {
    "app.compliance.title": "Compliance · Fase 15",
    "app.compliance.subtitle": "Pack · LGPD · i18n scaffold · jurisdição BR",
    "app.compliance.generatePack": "Gerar compliance pack",
    "app.compliance.dataMap": "Data map",
    "app.compliance.privacyExport": "Solicitar export",
    "app.compliance.privacyErase": "Solicitar erase (honesto)",
    "app.compliance.noForeignTax": "Sem regras fiscais estrangeiras neste produto",
    "app.compliance.jurisdictionBr": "Jurisdição BR documentada",
    "common.back": "Voltar",
  },
  en: {
    "app.compliance.title": "Compliance · Phase 15",
    "app.compliance.subtitle": "Pack · privacy · i18n scaffold · BR jurisdiction",
    "app.compliance.generatePack": "Generate compliance pack",
    "app.compliance.dataMap": "Data map",
    "app.compliance.privacyExport": "Request export",
    "app.compliance.privacyErase": "Request erase (honest)",
    "app.compliance.noForeignTax": "No foreign tax engines in this product",
    "app.compliance.jurisdictionBr": "BR jurisdiction documented",
    "common.back": "Back",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["pt-BR"];

export function normalizeLocale(raw?: string | null): LocaleCode {
  if (!raw) return "pt-BR";
  const v = raw.toLowerCase();
  if (v === "en" || v.startsWith("en-")) return "en";
  return "pt-BR";
}

export function t(key: MessageKey, locale: LocaleCode = "pt-BR"): string {
  return MESSAGES[locale][key] ?? MESSAGES["pt-BR"][key] ?? key;
}

export function listLocales(): LocaleCode[] {
  return ["pt-BR", "en"];
}

export function i18nCoverageReport(): { locale: LocaleCode; keys: number }[] {
  return listLocales().map((locale) => ({
    locale,
    keys: Object.keys(MESSAGES[locale]).length,
  }));
}
