import type { ExportPrivacyPolicy, ExportPrivacyProfile } from "@/lib/export/v2/types";
import { maskAccessKey } from "@/lib/security/redaction";
import { formatCnpj } from "@/lib/fiscal/cnpj";

export function resolvePrivacyPolicy(profile: ExportPrivacyProfile): ExportPrivacyPolicy {
  if (profile === "operational_full") {
    return {
      profile,
      maskAccessKeys: false,
      maskPartyDocs: false,
      includeAddresses: true,
      includeRawStructures: false,
      note: "Arquivo operacional com dados fiscais sensíveis (chave e documentos completos).",
    };
  }
  if (profile === "shareable_masked") {
    return {
      profile,
      maskAccessKeys: true,
      maskPartyDocs: true,
      includeAddresses: false,
      includeRawStructures: false,
      note: "Arquivo compartilhável: chaves e documentos mascarados.",
    };
  }
  return {
    profile: "custom",
    maskAccessKeys: true,
    maskPartyDocs: true,
    includeAddresses: false,
    includeRawStructures: false,
    note: "Perfil customizado com defaults seguros (mascarado).",
  };
}

export function applyAccessKey(key: string | undefined, privacy: ExportPrivacyPolicy): string {
  if (!key) return "";
  return privacy.maskAccessKeys ? maskAccessKey(key) : key;
}

export function applyPartyDoc(doc: string | undefined, privacy: ExportPrivacyPolicy): string {
  if (!doc) return "";
  if (!privacy.maskPartyDocs) {
    const formatted = formatCnpj(doc);
    return formatted !== "—" ? formatted : doc;
  }
  const formatted = formatCnpj(doc, true);
  return formatted !== "—" ? formatted : maskAccessKey(doc);
}
