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

export const REINF_LAYOUT_2026 = "REINF_R1000_2026_DRAFT";
export const REINF_SOURCE_ID = "official:sped:reinf:pending-registry";

const DISCLAIMER =
  "Pacote assistido EFD-Reinf (rascunho JSON/XML-like). Não envia ao portal, não assina com certificado e não substitui eventos oficiais. Eventos de serviço exigem confirmação contratual.";

function detect(context: ObligationContext): RequiredDataResult {
  const serviceDocs = context.documents.filter(
    (d) =>
      d.documentType === "NFSE" ||
      (/serv/i.test(d.natureOperation || "") && d.cfopMain?.startsWith("5") === false),
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
      id: "events",
      label: "Eventos de serviços (R-2010/R-2020)",
      status: serviceDocs.length ? ("review" as const) : ("na" as const),
      message: serviceDocs.length
        ? `${serviceDocs.length} candidato(s) — confirmar contrato`
        : "Nenhum NFS-e/serviço claro no lote; só R-1000 info cadastral",
    },
    {
      id: "certificate",
      label: "Certificado A1/A3 para transmissão",
      status: "unsupported" as const,
      message: "Fora do escopo deste app",
    },
  ];
  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return { items, canGenerate: blockingCount === 0, blockingCount };
}

function build(context: ObligationContext): ObligationBuildResult {
  const warnings = [
    "Formato de demonstração (JSON embutido em registro DEMO) — não é schema XSD oficial pronto para transmissão.",
    "Sem assinatura digital.",
  ];
  const period = context.periodStart.slice(0, 7);
  const infoContri = {
    evento: "R-1000",
    ideEvento: { tpAmb: 2, procEmi: 1, verProc: REINF_LAYOUT_2026, perApur: period },
    ideContri: { tpInsc: 1, nrInsc: context.cnpj.replace(/\D/g, "").slice(0, 14) },
    infoCadastro: {
      classTrib: "00",
      indEscrituracao: 0,
      indDesoneracao: 0,
      indAcordoIsenMulta: 0,
      indSitPJ: 0,
      contato: { nmCtt: context.accountantName || "DEMO", cpfCtt: context.accountantCpf || "00000000000" },
    },
  };

  const candidates = context.documents
    .filter((d) => d.documentType === "NFSE" || /serv/i.test(d.natureOperation || ""))
    .slice(0, 20)
    .map((d) => ({
      evento: "R-2010-candidato",
      status: "pending_confirmation",
      accessKey: d.accessKey,
      number: d.number,
      emitterDoc: d.emitterDoc,
      receiverDoc: d.receiverDoc,
      totalValue: d.totalValue,
      issueDate: d.issueDate,
      note: "Candidato a tomador/prestador — falta vínculo contratual e classificação Reinf",
    }));

  if (!candidates.length) {
    warnings.push("Sem candidatos R-2010/R-2020 a partir do lote.");
  }

  const payload = {
    disclaimer: DISCLAIMER,
    layoutVersion: REINF_LAYOUT_2026,
    generatedAt: new Date().toISOString(),
    events: [infoContri, ...candidates],
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
    lineage: candidates.map((c) => ({
      record: "R-2010-candidato",
      field: "nrInsc",
      value: String(c.emitterDoc || ""),
      sourceType: "xml" as const,
      sourceRef: c.accessKey,
    })),
    warnings,
  };
}

function validate(build: ObligationBuildResult): ValidationResult {
  return {
    level: 1,
    ok: build.records.length > 0,
    issues: [
      {
        code: "I_NO_TRANSMIT",
        severity: "info",
        message: "Pacote demo — não transmitir ao eSocial/Reinf",
      },
    ],
  };
}

async function serialize(build: ObligationBuildResult): Promise<SerializedObligation> {
  const content = `${build.records[0]?.fields[0] || "{}"}\n`;
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
