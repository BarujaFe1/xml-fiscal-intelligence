import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
} from "@/modules/obligations/reinf/lifecycle";
import { REINF_CATALOG, listImplementedEvents } from "@/modules/obligations/reinf/catalog";
import { buildR1000Xml, hashXml } from "@/modules/obligations/reinf/xml/builders";
import { stubLocalSign } from "@/modules/obligations/reinf/signer/local-agent";
import { submitReinfEvent, isReinfSubmitEnabled } from "@/modules/obligations/reinf/ws/client";
import {
  parseDctfWebImportCsv,
  reconcileDctfVsReinf,
} from "@/modules/obligations/reinf/dctf/reconcile";
import { createDraftR1000 } from "@/modules/obligations/reinf/service";
import { runObligationPlugin, reinfPlugin } from "@/modules/obligations";

describe("Reinf event engine Fase 3", () => {
  it("loads versioned catalog subset", () => {
    expect(REINF_CATALOG.version).toBeTruthy();
    expect(listImplementedEvents().some((e) => e.code === "R-1000")).toBe(true);
    expect(listImplementedEvents().some((e) => e.code === "R-2010")).toBe(true);
  });

  it("blocks invalid lifecycle transitions", () => {
    expect(canTransition("draft", "ready")).toBe(true);
    expect(canTransition("draft", "accepted")).toBe(false);
    expect(() => assertTransition("draft", "submitted")).toThrow(/inválida/);
  });

  it("builds R-1000 XML with hash and stub-signs", async () => {
    const xml = buildR1000Xml({
      cnpj: "11222333000181",
      periodKey: "2026-07",
      contactName: "Demo",
      contactCpf: "39053344705",
    });
    expect(xml).toContain("evtInfoContri");
    const hash = await hashXml(xml);
    const signed = await stubLocalSign({
      eventId: "e1",
      xmlUnsigned: xml,
      contentHash: hash,
    });
    expect(signed.xmlSigned).toContain("xfi-local-signer-stub");
    expect(signed.signedHash).toBeTruthy();
  });

  it("submit is dry-run when FEATURE_REINF_SUBMIT off", async () => {
    expect(isReinfSubmitEnabled()).toBe(false);
    const res = await submitReinfEvent({
      id: "e1",
      eventCode: "R-1000",
      idempotencyKey: "k1",
      xmlSigned: "<xml/>",
    });
    expect(res.dryRun).toBe(true);
    expect(res.ok).toBe(false);
  });

  it("reconciles DCTF CSV against Reinf expectations", () => {
    const dctf = parseDctfWebImportCsv("periodo;cod_receita;valor\n2026-07;0561;1000,00\n");
    const recon = reconcileDctfVsReinf(dctf, [
      {
        periodKey: "2026-07",
        eventCode: "R-2010",
        eventId: "ev1",
        amount: "1000,00",
      },
    ]);
    expect(recon.matched).toBe(1);
    expect(recon.unmatchedDctf).toBe(0);
  });

  it("creates draft event service object", async () => {
    const ev = await createDraftR1000({
      workspaceId: "ws",
      companyId: "co",
      cnpj: "11222333000181",
      periodKey: "2026-07",
    });
    expect(ev.status).toBe("draft");
    expect(ev.eventCode).toBe("R-1000");
    expect(ev.environment).toBe("restricted");
  });

  it("plugin package includes XML hashes", async () => {
    const out = await runObligationPlugin(reinfPlugin, {
      workspaceId: "ws",
      companyId: "co",
      establishmentId: "est",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      layoutVersion: REINF_CATALOG.version,
      uf: "SP",
      cnpj: "11222333000181",
      companyName: "DEMO",
      profile: "A",
      activityCode: "1",
      purpose: "0",
      documents: [],
    });
    expect(out.readiness.canGenerate).toBe(true);
    const parsed = JSON.parse(out.serialized!.content);
    expect(parsed.events[0].code).toBe("R-1000");
    expect(parsed.events[0].contentHash).toMatch(/^[a-f0-9]+$/i);
  });
});
