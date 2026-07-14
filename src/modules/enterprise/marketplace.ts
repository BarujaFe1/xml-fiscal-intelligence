/**
 * Marketplace de cenários — tenant interno, opt-in, import com re-lab obrigatório.
 */

import type { ValidatedScenario } from "@/modules/homologation/types";
import { createScenarioDraft } from "@/modules/homologation/scenarios";
import { sanitizeAuditDetail } from "@/modules/governance/audit-export";
import type {
  MarketplaceImportResult,
  MarketplaceListing,
} from "@/modules/enterprise/types";

function fingerprint(hash?: string): string | undefined {
  if (!hash || hash.length < 8) return undefined;
  return `${hash.slice(0, 8)}…`;
}

export function publishScenarioListing(input: {
  tenantId: string;
  workspaceId: string;
  scenario: ValidatedScenario;
  title?: string;
  goldenPackVersion: string;
}): MarketplaceListing {
  const scn = input.scenario;
  if (scn.status !== "validated_scope_ready" && scn.status !== "homologation_grade") {
    throw new Error("somente cenários homologation_grade ou validated_scope_ready");
  }
  if (!scn.homologationGrade) {
    throw new Error("publicação exige homologationGrade");
  }
  const now = new Date().toISOString();
  return {
    id: `mkt_${scn.obligationId}_${Date.now()}`,
    tenantId: input.tenantId,
    sourceWorkspaceId: input.workspaceId,
    title: sanitizeAuditDetail(
      input.title || `${scn.obligationId} ${scn.uf || "BR"} ${scn.periodKey}`,
    ),
    obligationId: scn.obligationId,
    uf: scn.uf,
    regime: scn.regime,
    periodKeyPattern: scn.periodKey.replace(/\d{2}$/, "MM"),
    layoutVersion: scn.layoutVersion,
    program: scn.program,
    goldenPackVersion: input.goldenPackVersion,
    status: "published",
    contentFingerprint: fingerprint(scn.contentHash),
    cellMaturityClaim:
      scn.status === "validated_scope_ready" ? "validated_scope" : "official_validator_beta",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function listPublishedForTenant(
  listings: MarketplaceListing[],
  tenantId: string,
): MarketplaceListing[] {
  return listings.filter((l) => l.tenantId === tenantId && l.status === "published");
}

/**
 * Import cria rascunho no workspace alvo forçando lab_pending — nunca copia maturity.
 */
export function importListingWithRelab(input: {
  listing: MarketplaceListing;
  targetWorkspaceId: string;
  tenantId: string;
}): { scenario: ValidatedScenario; result: MarketplaceImportResult } {
  if (input.listing.tenantId !== input.tenantId) {
    throw new Error("marketplace restrito ao mesmo tenant");
  }
  if (input.listing.status !== "published") {
    throw new Error("listing não publicado");
  }
  const scenario = createScenarioDraft({
    workspaceId: input.targetWorkspaceId,
    obligationId: input.listing.obligationId,
    periodKey: input.listing.periodKeyPattern,
    layoutVersion: input.listing.layoutVersion,
    program: input.listing.program,
    regime: input.listing.regime,
    uf: input.listing.uf,
  });
  // Força revalidação — sem herdar grade
  scenario.status = "lab_pending";
  scenario.homologationGrade = false;
  scenario.section28Notes = `import_from_marketplace:${input.listing.id}; requires_relab`;
  const result: MarketplaceImportResult = {
    listingId: input.listing.id,
    targetWorkspaceId: input.targetWorkspaceId,
    scenarioId: scenario.id,
    requiresRelab: true,
    statusForced: "lab_pending",
  };
  return { scenario, result };
}

export function retireListing(listing: MarketplaceListing): MarketplaceListing {
  return {
    ...listing,
    status: "retired",
    updatedAt: new Date().toISOString(),
  };
}
