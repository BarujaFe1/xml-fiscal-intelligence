import { sha256Hex } from "@/lib/security/hash";
import type {
  FiscalObligationPlugin,
  ObligationBuildResult,
  ObligationContext,
  ObligationRecord,
  RequiredDataResult,
  SerializedObligation,
  ValidationResult,
} from "@/modules/obligations/core/types";
import { defaultManifest } from "@/modules/obligations/core/pipe";
import { REINF_CATALOG, listImplementedEvents } from "@/modules/obligations/reinf/catalog";
import { buildR1000Xml, buildR2010CandidateXml, hashXml } from "@/modules/obligations/reinf/xml/builders";

export const REINF_LAYOUT_2026 = REINF_CATALOG.version;
export const REINF_SOURCE_ID = "official:sped:efd-reinf:hub";

const DISCLAIMER =
  "EFD-Reinf assistido (Fase 3): XML canônico draft + lifecycle local. Não transmite sem FEATURE_REINF_SUBMIT. Assinatura só via agente local. Não substitui eventos oficiais nem XSD completo.";

function detect(context: ObligationContext): RequiredDataResult {
  const serviceDocs = context.documents.filter(
    (d) => d.documentType === "NFSE" || /serv/i.test(d.natureOperation || ""),
  );
  const items = [
    {
      id: "cnpj",
      label: "CNPJ do contribuinte (R-1000)",
      status: context.cnpj ? ("complete" as const) : ("blocking" as const),
    },
    {
      id: "period",
      label: "Período de apuração",
      status: context.periodStart ? ("complete" as const) : ("blocking" as const),
    },
    {
      id: "catalog",
      label: `Catálogo ${REINF_CATALOG.version}`,
      status: "complete" as const,
      message: `${listImplementedEvents().length} evento(s) implemented no subset`,
    },
    {
      id: "events",
      label: "Candidatos R-2010 (NFS-e/serviço)",
      status: serviceDocs.length ? ("review" as const) : ("na" as const),
      message: serviceDocs.length
        ? `${serviceDocs.length} candidato(s) — confirmar contrato`
        : "Somente R-1000 cadastral neste lote",
    },
    {
      id: "certificate",
      label: "Assinatura (agente local)",
      status: "manual" as const,
      message: "PFX nunca no browser — ver signer/local-agent",
    },
    {
      id: "submit",
      label: "Transmissão WS",
      status: "unsupported" as const,
      message: "Desligada por padrão (FEATURE_REINF_SUBMIT)",
    },
  ];
  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return { items, canGenerate: blockingCount === 0, blockingCount };
}

async function build(context: ObligationContext): Promise<ObligationBuildResult> {
  const warnings = [
    "XML draft com namespace provisional — validar XSD oficial antes de assinar/enviar.",
    "Submit oficial desligado até feature flags + revisão de endpoints.",
  ];
  const period = context.periodStart.slice(0, 7);
  const r1000 = buildR1000Xml({
    cnpj: context.cnpj,
    periodKey: period,
    contactName: context.accountantName,
    contactCpf: context.accountantCpf,
    tpAmb: 2,
  });

  const candidates = context.documents
    .filter((d) => d.documentType === "NFSE" || /serv/i.test(d.natureOperation || ""))
    .slice(0, 20);

  const events: Array<{ code: string; xml: string; hash: string }> = [
    { code: "R-1000", xml: r1000, hash: await hashXml(r1000) },
  ];

  for (const d of candidates) {
    const xml = buildR2010CandidateXml({
      cnpj: context.cnpj,
      periodKey: period,
      tomadorDoc: d.emitterDoc,
      vlServico: d.totalValue,
      accessKey: d.accessKey,
    });
    events.push({ code: "R-2010", xml, hash: await hashXml(xml) });
  }
  if (!candidates.length) warnings.push("Sem candidatos R-2010 a partir do lote.");

  const payload = {
    disclaimer: DISCLAIMER,
    catalogVersion: REINF_CATALOG.version,
    layoutVersion: REINF_LAYOUT_2026,
    generatedAt: new Date().toISOString(),
    environment: "restricted",
    events: events.map((e) => ({
      code: e.code,
      contentHash: e.hash,
      xml: e.xml,
      status: "draft",
    })),
  };

  const records: ObligationRecord[] = [
    {
      type: "REINF_PACKAGE",
      fields: [JSON.stringify(payload)],
    },
  ];

  return {
    obligationId: "reinf",
    layoutVersion: REINF_LAYOUT_2026,
    records,
    lineage: events.map((e) => ({
      record: e.code,
      field: "contentHash",
      value: e.hash,
      sourceType: "derived" as const,
    })),
    warnings,
  };
}

function validate(buildResult: ObligationBuildResult): ValidationResult {
  return {
    level: 1,
    ok: buildResult.records.length > 0,
    issues: [
      {
        code: "I_NO_TRANSMIT_DEFAULT",
        severity: "info",
        message: "Pacote local — FEATURE_REINF_SUBMIT=false por padrão",
      },
    ],
  };
}

async function serialize(buildResult: ObligationBuildResult): Promise<SerializedObligation> {
  const content = `${buildResult.records[0]?.fields[0] || "{}"}\n`;
  const contentHash = await sha256Hex(content);
  let eventCount = 1;
  try {
    eventCount = JSON.parse(content).events?.length || 1;
  } catch {
    eventCount = 1;
  }
  return {
    encoding: "utf-8",
    lineEnding: "\r\n",
    content,
    contentHash,
    recordCount: eventCount,
  };
}

export const reinfPlugin: FiscalObligationPlugin = {
  id: "reinf",
  name: "EFD-Reinf",
  jurisdiction: "federal",
  supportedVersions: [REINF_LAYOUT_2026],
  async resolveVersion() {
    return { layoutVersion: REINF_LAYOUT_2026, sourceId: REINF_SOURCE_ID };
  },
  async detectRequiredData(context) {
    return detect(context);
  },
  async build(context) {
    return build(context);
  },
  async validate(buildResult) {
    return validate(buildResult);
  },
  async serialize(buildResult) {
    return serialize(buildResult);
  },
  async createManifest(buildResult, serialized, context, validation) {
    return defaultManifest({
      obligationId: "reinf",
      build: buildResult,
      serialized,
      context,
      validation,
      disclaimer: DISCLAIMER,
    });
  },
};
