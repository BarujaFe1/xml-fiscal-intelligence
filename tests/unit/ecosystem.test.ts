import { describe, expect, it, beforeEach } from "vitest";
import {
  SLO_DEFINITIONS,
  computeSloSnapshot,
  computeErrorBudget,
  seedStagingApiStatusSamples,
  recordSloSample,
  slaLinkageNotes,
} from "@/modules/ecosystem/slo";
import {
  startSpan,
  endSpan,
  exportPrometheusText,
  clearSpansForTests,
  listSpans,
} from "@/modules/ecosystem/otel-hooks";
import { buildSloAlert } from "@/modules/ecosystem/slo-alerts";
import {
  createPartnerInvite,
  acceptPartnerInvite,
  assertPartnerCannotTransmit,
  partnerMayPrepare,
  whiteLabelCommercialRow,
} from "@/modules/ecosystem/partners";
import {
  createTotvsLivePilotAdapter,
  runTotvsLivePilotGolden,
  fetchTotvsLiveHttpMinimal,
  postConnectionRehomologationReminders,
} from "@/modules/ecosystem/totvs-live-pilot";
import {
  ECOSYSTEM_PLATFORM_MATURITY,
  ecosystemHealth,
  section28Phase14Report,
} from "@/modules/ecosystem/platform";
import { bindRole } from "@/modules/governance/rbac";
import { createScenarioDraft } from "@/modules/homologation/scenarios";
import { assertCatalogSafe, listRegisteredAdapters, getAdapter } from "@/modules/continuous-ops/erp/registry";
import { OBLIGATION_SUPPORT_PROFILES } from "@/modules/obligations";
import { buildCommercialSupportMatrix, assertNoFalseProduction } from "@/modules/ops/commercial-matrix";

describe("Ecosystem Fase 14", () => {
  beforeEach(() => {
    clearSpansForTests();
  });

  it("SLO staging medido + error budget + prometheus", () => {
    expect(SLO_DEFINITIONS.length).toBeGreaterThanOrEqual(4);
    const samples = seedStagingApiStatusSamples(100);
    const snap = computeSloSnapshot("api_status_availability", samples);
    expect(snap.sampleCount).toBe(100);
    expect(snap.meetsTarget).toBe(true);
    expect(snap.availabilityPct!).toBeGreaterThanOrEqual(99);
    const budget = computeErrorBudget(snap);
    expect(budget.exhausted).toBe(false);
    expect(slaLinkageNotes()).toMatch(/generation/);
    const span = startSpan("api.status", "server");
    endSpan(span, { ok: true });
    expect(listSpans(1)[0]?.name).toBe("api.status");
    const prom = exportPrometheusText({ snapshots: [snap], samples });
    expect(prom).toMatch(/xfi_slo_availability_pct/);
    const alert = buildSloAlert({ workspaceId: "w", snap, budget });
    expect(alert).toBeNull();
  });

  it("alerta SLO sanitiza CNPJ quando breach", () => {
    const samples = [
      recordSloSample({ sloId: "api_status_availability", success: false }),
      recordSloSample({ sloId: "api_status_availability", success: false }),
    ];
    const snap = computeSloSnapshot("api_status_availability", samples);
    const budget = computeErrorBudget(snap);
    expect(snap.meetsTarget).toBe(false);
    const alert = buildSloAlert({ workspaceId: "w", snap, budget });
    expect(alert).not.toBeNull();
    expect(alert!.body).not.toMatch(/11222333000181/);
  });

  it("partner_auditor prepare ok e transmit bloqueado", () => {
    const owner = bindRole({ workspaceId: "ws", userId: "owner", role: "owner" });
    const inv = createPartnerInvite({
      tenantId: "t",
      hostWorkspaceId: "ws",
      partnerEmail: "a@b.com",
      whiteLabelPreview: true,
      actorBindings: [owner],
      actorUserId: "owner",
    });
    const { binding } = acceptPartnerInvite({
      invite: inv,
      partnerUserId: "p1",
      partnerWorkspaceId: "ws_p",
    });
    expect(binding.role).toBe("partner_auditor");
    expect(partnerMayPrepare({ bindings: [binding], workspaceId: "ws", userId: "p1" })).toBe(true);
    expect(() =>
      assertPartnerCannotTransmit({ bindings: [binding], workspaceId: "ws", userId: "p1" }),
    ).not.toThrow();
    expect(whiteLabelCommercialRow(true).claimAllowed).toBe(false);
    expect(() =>
      createPartnerInvite({
        tenantId: "t",
        hostWorkspaceId: "ws",
        partnerEmail: "x@y.com",
        actorBindings: [binding],
        actorUserId: "p1",
      }),
    ).toThrow(/invite_partner|permissão|papel/i);
  });

  it("TOTVS live gated + HTTP flag + rehomologation reminders", async () => {
    const off = createTotvsLivePilotAdapter({});
    expect(off.liveConnectionEnabled).toBe(false);
    expect(runTotvsLivePilotGolden({}).ok).toBe(true);
    expect(assertCatalogSafe({})).toBe(true);
    expect(getAdapter("totvs_live_pilot", {})?.vendorId).toBe("totvs_live_pilot");
    expect(listRegisteredAdapters({}).length).toBeGreaterThanOrEqual(7);

    const onEnv = {
      XFI_ALLOW_LIVE_ERP: "1",
      XFI_TOTVS_ACCESS_TOKEN: "tok",
    };
    expect(createTotvsLivePilotAdapter(onEnv).liveConnectionEnabled).toBe(true);
    await expect(fetchTotvsLiveHttpMinimal(onEnv)).rejects.toThrow(/HTTP bloqueado/i);
    const httpOk = await fetchTotvsLiveHttpMinimal({ ...onEnv, XFI_ERP_HTTP: "1" });
    expect(httpOk.status).toBe("synth_ok");

    const scn = createScenarioDraft({
      workspaceId: "w",
      obligationId: "ecd",
      periodKey: "2026",
      layoutVersion: "x",
      program: "programa_ecd",
    });
    expect(postConnectionRehomologationReminders([scn])[0]?.scenarioId).toBe(scn.id);
  });

  it("health + comercial sem production", () => {
    expect(ECOSYSTEM_PLATFORM_MATURITY).toBe("internal_beta");
    expect(ecosystemHealth({}).stagingApiSloMeets).toBe(true);
    expect(ecosystemHealth({}).anyObligationProduction).toBe(false);
    expect(section28Phase14Report()).toMatch(/Fase 14/);
    const matrix = buildCommercialSupportMatrix();
    expect(assertNoFalseProduction(matrix)).toBe(true);
    expect(matrix.some((r) => r.resource.includes("Parceiros"))).toBe(true);
    expect(
      Object.values(OBLIGATION_SUPPORT_PROFILES).every((p) => p.maturity !== "production"),
    ).toBe(true);
  });
});
