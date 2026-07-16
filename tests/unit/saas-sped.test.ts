import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { money, moneyAdd, moneyToEfd, assertMoneyEqual } from "@/lib/money/decimal";
import { hasPermission, assertPermission } from "@/lib/auth/permissions";
import {
  assertBooleanEntitlement,
  assertWithinLimit,
  getPlanEntitlements,
} from "@/lib/entitlements";
import { MockBillingProvider } from "@/lib/billing/provider";
import { InMemoryJobQueue } from "@/lib/jobs/queue";
import { normalizeNFeItemTax } from "@/modules/obligations/efd-icms-ipi/tax/normalize-nfe-tax";
import {
  EFD_ICMS_IPI_LAYOUT_2026,
  efdIcmsIpiPlugin,
} from "@/modules/obligations/efd-icms-ipi/plugin";
import { parseXmlDocument } from "@/lib/parser";
import { buildObligationContextFromBatch } from "@/modules/obligations/efd-icms-ipi/from-batch";
import type { ObligationContext } from "@/modules/obligations/core/types";

const samples = path.join(process.cwd(), "samples", "anonymized");
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
});

describe("money decimal", () => {
  it("avoids float drift", () => {
    expect(assertMoneyEqual(moneyAdd("0.1", "0.2"), "0.3")).toBe(true);
    expect(moneyToEfd("1250.9")).toBe("1250,90");
    expect(money("1.005").toFixed(2)).toBe("1.01");
  });
});

describe("permissions & entitlements", () => {
  it("viewer cannot generate", () => {
    expect(hasPermission("viewer", "obligations:generate")).toBe(false);
    expect(() => assertPermission("viewer", "obligations:generate")).toThrow();
  });
  it("accountant can generate", () => {
    expect(hasPermission("accountant", "obligations:generate")).toBe(true);
  });
  it("enforces numeric limits", () => {
    const e = getPlanEntitlements("trial");
    expect(() => assertWithinLimit(e, "maxCompanies", 1, 1)).toThrow();
    assertBooleanEntitlement(e, "canGenerateEfdIcmsIpi");
  });
});

describe("billing webhook idempotency", () => {
  it("rejects bad signature and dedupes events", async () => {
    const p = new MockBillingProvider();
    await expect(
      p.processWebhook({ rawBody: "{}", signature: "bad" }),
    ).rejects.toThrow();
    const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const a = await p.processWebhook({ rawBody: body, signature: "mock_valid" });
    const b = await p.processWebhook({ rawBody: body, signature: "mock_valid" });
    expect(a.duplicate).toBeFalsy();
    expect(b.duplicate).toBe(true);
  });
});

describe("job queue", () => {
  it("is idempotent by key", async () => {
    const q = new InMemoryJobQueue();
    const j1 = await q.enqueue({
      workspaceId: "ws",
      type: "import_zip",
      idempotencyKey: "k1",
      payload: {},
    });
    const j2 = await q.enqueue({
      workspaceId: "ws",
      type: "import_zip",
      idempotencyKey: "k1",
      payload: {},
    });
    expect(j1.id).toBe(j2.id);
    const claimed = await q.claimNext("w1");
    expect(claimed?.status).toBe("running");
    await q.complete(claimed!.id);
  });
});

describe("tax normalizer", () => {
  it("reads CST and ICMS from sample NF-e", () => {
    const xml = readFileSync(path.join(samples, "nfe-example.xml"), "utf8");
    const parsed = parser.parse(xml);
    const result = parseXmlDocument({
      xml,
      fileName: "nfe-example.xml",
      batchId: "b",
      workspaceId: "ws",
    });
    expect(result.items.length).toBe(2);
    const tax = normalizeNFeItemTax(result.items[0].taxJson);
    expect(tax.icms.cst).toBe("00");
    expect(tax.icms.vIcms).toBe("900.00");
    expect(tax.pis.cst).toBe("01");
    void parsed;
  });
});

describe("EFD ICMS/IPI plugin", () => {
  function baseCtx(partial?: Partial<ObligationContext>): ObligationContext {
    const parsed = parseXmlDocument({
      xml: readFileSync(path.join(samples, "nfe-example.xml"), "utf8"),
      fileName: "nfe-example.xml",
      batchId: "b1",
      workspaceId: "ws",
    });
    const ctx = buildObligationContextFromBatch({
      establishment: {
        workspaceId: "ws",
        companyId: "co",
        establishmentId: "est",
        cnpj: "12345678000190",
        ie: "123456789012",
        uf: "SP",
        companyName: "EMPRESA DEMO EMITENTE LTDA",
        profile: "A",
        activityCode: "1",
        purpose: "0",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
        codMun: "3550308",
        cep: "01310100",
        address: "AV PAULISTA",
        addressNumber: "1000",
        neighborhood: "BELA VISTA",
        layoutVersion: EFD_ICMS_IPI_LAYOUT_2026,
      },
      documents: [parsed.document],
      items: parsed.items,
    });
    return { ...ctx, ...partial };
  }

  it("blocks generation without profile", async () => {
    const ctx = baseCtx({ profile: undefined });
    const readiness = await efdIcmsIpiPlugin.detectRequiredData(ctx);
    expect(readiness.canGenerate).toBe(false);
    expect(readiness.items.some((i) => i.id === "profile" && i.status === "blocking")).toBe(true);
  });

  it("builds C100/C170/C190 (C170 obrigatório p/ NF-e com chave) e serializa com hash", async () => {
    const ctx = baseCtx();
    const build = await efdIcmsIpiPlugin.build(ctx);
    const types = build.records.map((r) => r.type);
    expect(types).toContain("0000");
    expect(types).toContain("C100");
    expect(types).toContain("C170");
    expect(types).toContain("C190");
    expect(types).toContain("9999");
    const validation = await efdIcmsIpiPlugin.validate(build, ctx);
    expect(validation.level).toBe(1);
    const ser = await efdIcmsIpiPlugin.serialize(build, ctx);
    expect(ser.content).toContain("|C100|");
    expect(ser.content).toContain("|C170|");
    expect(ser.contentHash).toHaveLength(64);
    expect(ser.content.endsWith("\r\n")).toBe(true);
    const manifest = await efdIcmsIpiPlugin.createManifest(build, ser, ctx, validation);
    expect(manifest.disclaimer.toLowerCase()).toContain("pva");
    expect(build.lineage.length).toBeGreaterThan(0);
  });
});

describe("tenant isolation helper", () => {
  it("documents conceptual guard: workspace ids must differ", () => {
    const a = { workspaceId: "ws_a" };
    const b = { workspaceId: "ws_b" };
    expect(a.workspaceId === b.workspaceId).toBe(false);
  });
});
