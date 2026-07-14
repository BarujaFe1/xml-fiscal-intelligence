import type { EfdUfPlugin } from "@/modules/obligations/efd-icms-ipi/uf/types";
import { emptyUfPlugin } from "@/modules/obligations/efd-icms-ipi/uf/types";
import { ufSpPlugin } from "@/modules/obligations/efd-icms-ipi/uf/sp";

const REGISTRY: Record<string, EfdUfPlugin> = {
  SP: ufSpPlugin,
};

export function getEfdUfPlugin(uf?: string): EfdUfPlugin {
  const key = (uf || "").toUpperCase().slice(0, 2);
  if (!key) return emptyUfPlugin("??");
  return REGISTRY[key] || emptyUfPlugin(key);
}

export function listRegisteredEfdUfs(): string[] {
  return Object.keys(REGISTRY).sort();
}
