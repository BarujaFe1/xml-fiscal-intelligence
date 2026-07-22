import type { EfdUfPlugin } from "@/modules/obligations/efd-icms-ipi/uf/types";
import { emptyUfPlugin } from "@/modules/obligations/efd-icms-ipi/uf/types";
import { ufSpPlugin } from "@/modules/obligations/efd-icms-ipi/uf/sp";
import { getObligationSupport, type ObligationSupportLevel } from "@/modules/obligations/support-level";

const REGISTRY: Record<string, EfdUfPlugin> = {
  SP: ufSpPlugin,
};

export function getEfdUfPlugin(uf?: string): EfdUfPlugin {
  const key = (uf || "").toUpperCase().slice(0, 2);
  const base = !key ? emptyUfPlugin("??") : REGISTRY[key] || emptyUfPlugin(key);
  const supportLevel: ObligationSupportLevel = getObligationSupport("efd-icms-ipi", key || undefined).level;
  return { ...base, supportLevel };
}

export function listRegisteredEfdUfs(): string[] {
  return Object.keys(REGISTRY).sort();
}
