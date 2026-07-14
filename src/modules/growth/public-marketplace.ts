/**
 * Marketplace público controlado — moderação, rate limit, import com re-lab.
 */

import type { MarketplaceListing } from "@/modules/enterprise/types";
import { importListingWithRelab } from "@/modules/enterprise/marketplace";
import { sanitizeAuditDetail } from "@/modules/governance/audit-export";
import type {
  MarketplaceRateLimit,
  PublicMarketplaceListing,
  PublicListingModeration,
} from "@/modules/growth/types";
import type { ValidatedScenario } from "@/modules/homologation/types";
import type { MarketplaceImportResult } from "@/modules/enterprise/types";

export function hourBucket(d = new Date()): string {
  return d.toISOString().slice(0, 13);
}

export function defaultMarketplaceRateLimit(tenantId: string): MarketplaceRateLimit {
  return {
    tenantId,
    publishesThisHour: 0,
    importsThisHour: 0,
    hourBucket: hourBucket(),
    maxPublishesPerHour: 10,
    maxImportsPerHour: 30,
  };
}

export function assertWithinMarketplaceRate(
  limit: MarketplaceRateLimit,
  kind: "publish" | "import",
): { ok: boolean; reason?: string } {
  const bucket = hourBucket();
  const cur =
    limit.hourBucket === bucket
      ? limit
      : { ...limit, publishesThisHour: 0, importsThisHour: 0, hourBucket: bucket };
  if (kind === "publish" && cur.publishesThisHour >= cur.maxPublishesPerHour) {
    return { ok: false, reason: `rate limit publish ${cur.maxPublishesPerHour}/h` };
  }
  if (kind === "import" && cur.importsThisHour >= cur.maxImportsPerHour) {
    return { ok: false, reason: `rate limit import ${cur.maxImportsPerHour}/h` };
  }
  return { ok: true };
}

export function bumpMarketplaceRate(
  limit: MarketplaceRateLimit,
  kind: "publish" | "import",
): MarketplaceRateLimit {
  const bucket = hourBucket();
  const base =
    limit.hourBucket === bucket
      ? limit
      : { ...limit, publishesThisHour: 0, importsThisHour: 0, hourBucket: bucket };
  if (kind === "publish") {
    return { ...base, publishesThisHour: base.publishesThisHour + 1 };
  }
  return { ...base, importsThisHour: base.importsThisHour + 1 };
}

/** Promove listing tenant → fila pública (pending_review). */
export function submitPublicListing(input: {
  listing: MarketplaceListing;
  compliancePackHashRef?: string;
  rateLimit: MarketplaceRateLimit;
}): { publicListing: PublicMarketplaceListing; rateLimit: MarketplaceRateLimit } {
  if (input.listing.status !== "published") {
    throw new Error("só listing published no tenant pode ir ao público");
  }
  const gate = assertWithinMarketplaceRate(input.rateLimit, "publish");
  if (!gate.ok) throw new Error(gate.reason);
  const now = new Date().toISOString();
  const publicListing: PublicMarketplaceListing = {
    id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sourceListingId: input.listing.id,
    sourceTenantId: input.listing.tenantId,
    title: sanitizeAuditDetail(input.listing.title),
    obligationId: input.listing.obligationId,
    uf: input.listing.uf,
    regime: input.listing.regime,
    layoutVersion: input.listing.layoutVersion,
    program: input.listing.program,
    periodKeyPattern: input.listing.periodKeyPattern,
    goldenPackVersion: input.listing.goldenPackVersion,
    cellMaturityClaim: input.listing.cellMaturityClaim,
    contentFingerprint: input.listing.contentFingerprint,
    moderation: "pending_review",
    abuseFlags: [],
    compliancePackHashRef: input.compliancePackHashRef,
    createdAt: now,
    updatedAt: now,
  };
  return {
    publicListing,
    rateLimit: bumpMarketplaceRate(input.rateLimit, "publish"),
  };
}

export function moderatePublicListing(
  listing: PublicMarketplaceListing,
  to: Extract<PublicListingModeration, "approved" | "rejected" | "retired">,
  moderatorId: string,
  abuseFlags?: string[],
): PublicMarketplaceListing {
  if (listing.moderation === "retired" && to !== "retired") {
    throw new Error("listing retired");
  }
  const now = new Date().toISOString();
  return {
    ...listing,
    moderation: to,
    moderatorId,
    moderatedAt: now,
    publishedAt: to === "approved" ? listing.publishedAt || now : listing.publishedAt,
    abuseFlags: abuseFlags ?? listing.abuseFlags,
    updatedAt: now,
  };
}

export function flagAbuse(
  listing: PublicMarketplaceListing,
  flag: string,
): PublicMarketplaceListing {
  const flags = [...new Set([...listing.abuseFlags, flag.slice(0, 80)])];
  return {
    ...listing,
    abuseFlags: flags,
    moderation: flags.length >= 3 ? "rejected" : listing.moderation,
    updatedAt: new Date().toISOString(),
  };
}

export function listApprovedPublic(
  listings: PublicMarketplaceListing[],
  filter?: { obligationId?: string; uf?: string },
): PublicMarketplaceListing[] {
  return listings.filter((l) => {
    if (l.moderation !== "approved") return false;
    if (filter?.obligationId && l.obligationId !== filter.obligationId) return false;
    if (filter?.uf && (l.uf || "BR").toUpperCase() !== filter.uf.toUpperCase()) return false;
    return true;
  });
}

export function publicToSourceListingStub(
  pub: PublicMarketplaceListing,
  sourceWorkspaceId = "ws_public_stub",
): MarketplaceListing {
  const now = new Date().toISOString();
  return {
    id: pub.sourceListingId,
    tenantId: pub.sourceTenantId,
    sourceWorkspaceId,
    title: pub.title,
    obligationId: pub.obligationId,
    uf: pub.uf,
    regime: pub.regime,
    periodKeyPattern: pub.periodKeyPattern,
    layoutVersion: pub.layoutVersion,
    program: pub.program,
    goldenPackVersion: pub.goldenPackVersion,
    status: "published",
    contentFingerprint: pub.contentFingerprint,
    cellMaturityClaim: pub.cellMaturityClaim,
    publishedAt: pub.publishedAt,
    createdAt: pub.createdAt,
    updatedAt: now,
  };
}

/**
 * Import público: qualquer tenant pode importar approved — sempre lab_pending.
 */
export function importPublicListingWithRelab(input: {
  publicListing: PublicMarketplaceListing;
  targetWorkspaceId: string;
  targetTenantId: string;
  rateLimit: MarketplaceRateLimit;
}): {
  scenario: ValidatedScenario;
  result: MarketplaceImportResult;
  rateLimit: MarketplaceRateLimit;
} {
  if (input.publicListing.moderation !== "approved") {
    throw new Error("só listings approved no catálogo público");
  }
  if (input.publicListing.abuseFlags.length >= 3) {
    throw new Error("listing com abuse flags");
  }
  const gate = assertWithinMarketplaceRate(input.rateLimit, "import");
  if (!gate.ok) throw new Error(gate.reason);

  const bridged = publicToSourceListingStub(input.publicListing);
  bridged.tenantId = input.targetTenantId;

  const { scenario, result } = importListingWithRelab({
    listing: bridged,
    targetWorkspaceId: input.targetWorkspaceId,
    tenantId: input.targetTenantId,
  });
  scenario.section28Notes = `import_from_public_marketplace:${input.publicListing.id}; requires_relab; compliance=${input.publicListing.compliancePackHashRef || "n/a"}`;

  return {
    scenario,
    result: { ...result, requiresRelab: true, statusForced: "lab_pending" },
    rateLimit: bumpMarketplaceRate(input.rateLimit, "import"),
  };
}

export function assertImportForcesLabPending(scenario: ValidatedScenario): void {
  if (scenario.status !== "lab_pending" || scenario.homologationGrade) {
    throw new Error("import público deve forçar lab_pending sem grade");
  }
}
