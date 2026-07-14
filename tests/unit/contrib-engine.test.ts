import { describe, expect, it } from "vitest";
import type { ContribEntry, ContribSnapshot } from "@/modules/contrib/types";
import { assertRegimeForPeriod } from "@/modules/contrib/regimes";
import { listSupportedModes, parseContribMode } from "@/modules/contrib/modes";
import { cataloguedRuleImpacts, CONTRIB_RULE_SET_VERSIONS } from "@/modules/contrib/rule-sets";
import { validateRateio, applyRateio } from "@/modules/contrib/rateio";
import { buildBlocoMDrafts } from "@/modules/contrib/bloco-m";
import { findIllicitCredits, buildContribBooks } from "@/modules/contrib/books";
import { simulateWithWithoutCredit } from "@/modules/contrib/simulator";
import {
  parseDctfMitImportCsv,
  reconcileDctfMitVsContrib,
} from "@/modules/contrib/reconcile-dctf-mit";
import { isHomologationGradePgeRun } from "@/modules/obligations/efd-contribuicoes/homologation";
import {
  runObligationPlugin,
  efdContribuicoesPlugin,
  EFD_CONTRIB_LAYOUT_2026,
} from "@/modules/obligations";

function entry(
  partial: Partial<ContribEntry> & Pick<ContribEntry, "id" | "kind" | "amount">,
): ContribEntry {
  const now = new Date().toISOString();
  return {
    workspaceId: "ws",
    companyId: "co",
    periodKey: "2026-03",
    creditExplicit: partial.kind === "credit" ? true : true,
    origin: "manual",
    mode: "current_fact_generation",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function snap(entries: ContribEntry[]): ContribSnapshot {
  return {
    entries,
    rateio: [{ key: "pis_credit", label: "geral", weight: 1 }],
    regimeCode: "non_cumulative",
    mode: "current_fact_generation",
    periodKey: "2026-03",
  };
}

describe("EFD-Contribuições Fase 6", () => {
  it("regimes exigem sourceId/vigência", () => {
    expect(assertRegimeForPeriod("non_cumulative", "2026-03-01").ok).toBe(true);
    expect(assertRegimeForPeriod("cprb", "2026-03-01").profile?.sourceId).toBeTruthy();
  });

  it("modos dual nunca apagam histórico", () => {
    expect(listSupportedModes()).toContain("historical_and_credit_management");
    expect(parseContribMode("historical_and_credit_management")).toBe(
      "historical_and_credit_management",
    );
  });

  it("NTs catalogadas sem auto-ativar", () => {
    expect(CONTRIB_RULE_SET_VERSIONS.every((r) => r.activated === false)).toBe(true);
    expect(cataloguedRuleImpacts("2026-03-01").some((x) => /NT_11_2026/.test(x))).toBe(true);
  });

  it("rateio recusa soma != 1", () => {
    const issues = validateRateio([
      { key: "pis_credit", label: "a", weight: 0.4 },
      { key: "pis_credit", label: "b", weight: 0.4 },
    ]);
    expect(issues.some((i) => i.severity === "error")).toBe(true);
    expect(applyRateio(100, [{ key: "pis_credit", label: "g", weight: 1 }], "pis_credit")[0]?.amount).toBe(
      100,
    );
  });

  it("rejeita crédito ilícito e monta Bloco M golden parcial", () => {
    const illicit = entry({
      id: "bad",
      kind: "credit",
      amount: "50,00",
      creditExplicit: false,
    });
    expect(findIllicitCredits([illicit])).toHaveLength(1);

    const s = snap([
      entry({ id: "d1", kind: "debit", amount: "1000,00" }),
      entry({ id: "c1", kind: "credit", amount: "200,00", creditExplicit: true }),
    ]);
    const { drafts, warnings } = buildBlocoMDrafts(s);
    expect(drafts.some((d) => d.type === "M100")).toBe(true);
    expect(drafts.some((d) => d.type === "M200")).toBe(true);
    expect(warnings.some((w) => /COD_CRED/.test(w))).toBe(true);
    expect(buildContribBooks(s).find((b) => b.kind === "debit")?.amount).toBe(1000);
  });

  it("simulador gated + forceEnable", () => {
    const off = simulateWithWithoutCredit(snap([]));
    expect(off.enabled).toBe(false);
    const on = simulateWithWithoutCredit(
      snap([
        entry({ id: "d1", kind: "debit", amount: "1000,00" }),
        entry({ id: "c1", kind: "credit", amount: "200,00", creditExplicit: true }),
      ]),
      { forceEnable: true },
    );
    expect(on.scenarios.find((x) => x.id === "with_credit")?.toPayPis).toBe("800,00");
    expect(on.scenarios.find((x) => x.id === "without_credit")?.toPayPis).toBe("1000,00");
  });

  it("concilia DCTF/MIT por período+valor", () => {
    const imported = parseDctfMitImportCsv("2026-03;8109;800,00;dctfweb\n");
    const r = reconcileDctfMitVsContrib(imported, [
      { periodKey: "2026-03", kind: "debit", entryId: "e1", amount: "800,00" },
    ]);
    expect(r.matched).toBe(1);
    expect(r.ok).toBe(true);
  });

  it("homologationGrade PGE", () => {
    expect(
      isHomologationGradePgeRun({
        contentHash: "ab".repeat(16),
        programVersion: "1.0",
        resultStatus: "ok",
      }),
    ).toBe(true);
  });

  it("plugin domínio gera M100/M200 e bloqueia crédito ilícito", async () => {
    const bad = await runObligationPlugin(efdContribuicoesPlugin, {
      workspaceId: "ws",
      companyId: "co",
      establishmentId: "e",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      layoutVersion: EFD_CONTRIB_LAYOUT_2026,
      uf: "SP",
      cnpj: "11222333000181",
      companyName: "TESTE",
      purpose: "0",
      documents: [],
      extras: {
        contribSnapshot: snap([
          entry({ id: "bad", kind: "credit", amount: "10,00", creditExplicit: false }),
        ]),
      },
    });
    expect(bad.readiness.canGenerate).toBe(false);

    const ok = await runObligationPlugin(efdContribuicoesPlugin, {
      workspaceId: "ws",
      companyId: "co",
      establishmentId: "e",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      layoutVersion: EFD_CONTRIB_LAYOUT_2026,
      uf: "SP",
      cnpj: "11222333000181",
      companyName: "TESTE",
      purpose: "0",
      documents: [],
      extras: {
        regimeCode: "non_cumulative",
        contribSnapshot: snap([
          entry({ id: "d1", kind: "debit", amount: "1000,00" }),
          entry({ id: "c1", kind: "credit", amount: "200,00", creditExplicit: true }),
        ]),
      },
    });
    expect(ok.readiness.canGenerate).toBe(true);
    expect(ok.serialized?.content).toMatch(/\|M100\|/);
    expect(ok.serialized?.content).toMatch(/\|M200\|/);
    expect(ok.manifest?.disclaimer).toMatch(/dual|histórico|FEATURE_CONTRIB_SIMULATOR/i);
  });
});
