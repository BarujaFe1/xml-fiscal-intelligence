/**
 * Entitlements — never gate features with `if (plan === "pro")`.
 * Limits are versioned via plan_entitlements in DB; this module is the runtime contract.
 */

export type EntitlementKey =
  | "canGenerateEfdIcmsIpi"
  | "canUsePrivacyMode"
  | "hasApiAccess"
  | "hasAdvancedAudit"
  | "hasAiExplanations"
  | "hasPriorityProcessing"
  | "maxCompanies"
  | "maxEstablishments"
  | "maxUsers"
  | "maxDocumentsPerMonth"
  | "maxStorageBytes"
  | "maxExportsPerMonth"
  | "maxSpedGenerationsPerMonth";

export type EntitlementMap = Record<EntitlementKey, boolean | number>;

export const PLAN_SEEDS = {
  trial: {
    label: "Teste",
    entitlements: {
      canGenerateEfdIcmsIpi: true,
      canUsePrivacyMode: true,
      hasApiAccess: false,
      hasAdvancedAudit: true,
      hasAiExplanations: false,
      hasPriorityProcessing: false,
      maxCompanies: 1,
      maxEstablishments: 2,
      maxUsers: 3,
      maxDocumentsPerMonth: 2000,
      maxStorageBytes: 500 * 1024 * 1024,
      maxExportsPerMonth: 20,
      maxSpedGenerationsPerMonth: 5,
    } satisfies EntitlementMap,
  },
  essencial: {
    label: "Essencial",
    entitlements: {
      canGenerateEfdIcmsIpi: true,
      canUsePrivacyMode: true,
      hasApiAccess: false,
      hasAdvancedAudit: true,
      hasAiExplanations: false,
      hasPriorityProcessing: false,
      maxCompanies: 3,
      maxEstablishments: 10,
      maxUsers: 5,
      maxDocumentsPerMonth: 20000,
      maxStorageBytes: 5 * 1024 * 1024 * 1024,
      maxExportsPerMonth: 100,
      maxSpedGenerationsPerMonth: 30,
    } satisfies EntitlementMap,
  },
  profissional: {
    label: "Profissional",
    entitlements: {
      canGenerateEfdIcmsIpi: true,
      canUsePrivacyMode: true,
      hasApiAccess: true,
      hasAdvancedAudit: true,
      hasAiExplanations: true,
      hasPriorityProcessing: false,
      maxCompanies: 15,
      maxEstablishments: 50,
      maxUsers: 20,
      maxDocumentsPerMonth: 100000,
      maxStorageBytes: 50 * 1024 * 1024 * 1024,
      maxExportsPerMonth: 500,
      maxSpedGenerationsPerMonth: 200,
    } satisfies EntitlementMap,
  },
  escritorio: {
    label: "Escritório Contábil",
    entitlements: {
      canGenerateEfdIcmsIpi: true,
      canUsePrivacyMode: true,
      hasApiAccess: true,
      hasAdvancedAudit: true,
      hasAiExplanations: true,
      hasPriorityProcessing: true,
      maxCompanies: 100,
      maxEstablishments: 500,
      maxUsers: 50,
      maxDocumentsPerMonth: 500000,
      maxStorageBytes: 200 * 1024 * 1024 * 1024,
      maxExportsPerMonth: 2000,
      maxSpedGenerationsPerMonth: 1000,
    } satisfies EntitlementMap,
  },
  enterprise: {
    label: "Enterprise",
    entitlements: {
      canGenerateEfdIcmsIpi: true,
      canUsePrivacyMode: true,
      hasApiAccess: true,
      hasAdvancedAudit: true,
      hasAiExplanations: true,
      hasPriorityProcessing: true,
      maxCompanies: 10000,
      maxEstablishments: 100000,
      maxUsers: 1000,
      maxDocumentsPerMonth: 10_000_000,
      maxStorageBytes: 2 * 1024 * 1024 * 1024 * 1024,
      maxExportsPerMonth: 100000,
      maxSpedGenerationsPerMonth: 100000,
    } satisfies EntitlementMap,
  },
} as const;

export type PlanSeedId = keyof typeof PLAN_SEEDS;

export function getPlanEntitlements(planId: PlanSeedId | string): EntitlementMap {
  const seed = PLAN_SEEDS[planId as PlanSeedId];
  return seed ? { ...seed.entitlements } : { ...PLAN_SEEDS.trial.entitlements };
}

export function assertBooleanEntitlement(map: EntitlementMap, key: EntitlementKey): void {
  if (map[key] !== true) {
    throw new Error(`Entitlement denied: ${key}`);
  }
}

export function assertWithinLimit(
  map: EntitlementMap,
  key: EntitlementKey,
  currentUsage: number,
  increment = 1,
): void {
  const limit = map[key];
  if (typeof limit !== "number") {
    throw new Error(`Entitlement ${key} is not a numeric limit`);
  }
  if (currentUsage + increment > limit) {
    throw new Error(`Limit exceeded for ${key}: ${currentUsage + increment} > ${limit}`);
  }
}
