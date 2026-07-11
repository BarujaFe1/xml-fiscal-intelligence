import type {
  FiscalObligationPlugin,
  ObligationBuildResult,
  ObligationContext,
  ObligationRecord,
  RequiredDataResult,
  SerializedObligation,
  ValidationResult,
  GenerationManifest,
  LineageEntry,
  ReadinessStatus,
} from "@/modules/obligations/core/types";
import { moneyAdd, moneyToEfd, moneyToFixed } from "@/lib/money/decimal";
import { sha256Hex } from "@/lib/security/hash";
import { isCnpjShape, normalizeCnpj, normalizeCpf } from "@/lib/fiscal/cnpj";

export const EFD_ICMS_IPI_LAYOUT_2026 = "EFD_ICMS_IPI_2026_DRAFT";
export const EFD_SOURCE_ID = "official:sped:efd-icms-ipi:pending-registry";

function onlyDigits(v?: string) {
  return (v || "").replace(/\D/g, "");
}

/** CNPJ for EFD: preserve alphanumeric; strip only mask punctuation. */
function efdCnpj(v?: string) {
  return normalizeCnpj(v);
}

function pipe(fields: Array<string | undefined | null>): string {
  return `|${fields.map((f) => (f === undefined || f === null ? "" : String(f))).join("|")}|`;
}

/**
 * COD_VER conforme tabela do Ato COTEPE / NT (validado pelo PVA contra DT_FIN).
 * 018=2024 · 019=2025 · 020=2026 (NT 2025.001).
 */
export function efdIcmsIpiCodVer(periodEndIso?: string): string {
  const y = Number((periodEndIso || "").slice(0, 4));
  if (!Number.isFinite(y) || y <= 0) return "020";
  if (y >= 2026) return "020";
  if (y >= 2025) return "019";
  if (y >= 2024) return "018";
  return "017";
}

function dateEfd(iso?: string): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return "";
  return `${day}${m}${y}`;
}

/** Split party document into EFD CNPJ vs CPF fields without destroying letters. */
function partyDocFields(doc?: string): { cnpj: string; cpf: string } {
  const cnpj = efdCnpj(doc);
  if (isCnpjShape(cnpj)) return { cnpj, cpf: "" };
  const cpf = normalizeCpf(doc);
  if (cpf.length === 11) return { cnpj: "", cpf };
  return { cnpj: "", cpf: "" };
}

function participantCode(doc?: string) {
  const { cnpj, cpf } = partyDocFields(doc);
  const d = cnpj || cpf;
  return d ? `P${d}` : "";
}

function statusEstablishment(context: ObligationContext): ReadinessStatus {
  if (!context.cnpj || !context.uf) return "blocking";
  if (!context.ie) return "review";
  return "complete";
}

export function detectEfdRequiredData(context: ObligationContext): RequiredDataResult {
  const items = [
    {
      id: "establishment",
      label: "Estabelecimento (CNPJ/IE/UF)",
      status: statusEstablishment(context),
      message: !context.ie ? "IE ausente — revise se obrigatória na UF" : undefined,
      remediation: "Cadastre IE e COD_MUN no estabelecimento",
    },
    {
      id: "period",
      label: "Período DT_INI/DT_FIN",
      status: (context.periodStart && context.periodEnd ? "complete" : "blocking") as ReadinessStatus,
    },
    {
      id: "profile",
      label: "Perfil A/B/C",
      status: (context.profile ? "complete" : "blocking") as ReadinessStatus,
      remediation: "Informe o perfil SPED — não presumimos",
    },
    {
      id: "activity",
      label: "IND_ATIV",
      status: (context.activityCode !== undefined ? "complete" : "blocking") as ReadinessStatus,
      remediation: "Informe o indicador de atividade",
    },
    {
      id: "purpose",
      label: "Finalidade do arquivo",
      status: (context.purpose !== undefined ? "complete" : "blocking") as ReadinessStatus,
    },
    {
      id: "accountant",
      label: "Contabilista (0100)",
      status: (context.accountantName && context.accountantCpf
        ? "complete"
        : "review") as ReadinessStatus,
      message: "Recomendado para arquivo completo",
    },
    {
      id: "documents",
      label: "Documentos NF-e no período",
      status: (context.documents.some((d) => d.documentType === "NFE" || d.model === "55")
        ? "complete"
        : "blocking") as ReadinessStatus,
    },
    {
      id: "tax_normalized",
      label: "Impostos normalizados (CST/BC/alíq)",
      status: (context.documents.every((d) =>
        d.items.every((i) => i.tax.icms.cst || i.tax.icms.csosn),
      )
        ? "complete"
        : "blocking") as ReadinessStatus,
      remediation: "Normalize imposto da NF-e antes de gerar C170",
    },
    {
      id: "e110",
      label: "Apuração E110",
      status: (context.priorCreditBalance !== undefined ? "manual" : "review") as ReadinessStatus,
      message:
        "E110 não é soma silenciosa de XML. Informe saldo anterior ou marque N/A com justificativa no futuro.",
    },
    {
      id: "bloco_hkg",
      label: "Blocos H/K/G",
      status: "unsupported" as ReadinessStatus,
      message: "Fora do MVP controlado",
    },
  ];

  const blockingCount = items.filter((i) => i.status === "blocking").length;
  return { items, canGenerate: blockingCount === 0, blockingCount };
}

function build0000(ctx: ObligationContext): ObligationRecord {
  // Ordem oficial: REG COD_VER COD_FIN DT_INI DT_FIN NOME CNPJ CPF UF IE COD_MUN IM SUFRAMA IND_PERFIL IND_ATIV
  const fields = [
    "0000",
    efdIcmsIpiCodVer(ctx.periodEnd),
    ctx.purpose === "1" ? "1" : "0", // COD_FIN
    dateEfd(ctx.periodStart),
    dateEfd(ctx.periodEnd),
    ctx.companyName,
    efdCnpj(ctx.cnpj),
    "", // CPF
    ctx.uf,
    onlyDigits(ctx.ie),
    "", // COD_MUN — pending cadastro
    "", // IM
    "", // SUFRAMA
    ctx.profile || "",
    ctx.activityCode || "",
  ];
  const lineage: LineageEntry[] = [
    {
      record: "0000",
      field: "CNPJ",
      value: efdCnpj(ctx.cnpj),
      sourceType: "cadastro",
      sourceRef: ctx.establishmentId,
      ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_0000_CNPJ`,
    },
    {
      record: "0000",
      field: "COD_VER",
      value: efdIcmsIpiCodVer(ctx.periodEnd),
      sourceType: "derived",
      transformation: "from DT_FIN year (NT/Ato COTEPE)",
      ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_0000_COD_VER`,
    },
  ];
  return { type: "0000", fields, lineage };
}

function build0150(ctx: ObligationContext): ObligationRecord[] {
  const map = new Map<string, ObligationRecord>();
  for (const d of ctx.documents) {
    for (const party of [
      {
        doc: d.emitterDoc,
        name: d.emitterName,
        ie: d.emitterIe,
        uf: d.emitterUf,
        mun: d.emitterCityCode,
      },
      {
        doc: d.receiverDoc,
        name: d.receiverName,
        ie: d.receiverIe,
        uf: d.receiverUf,
        mun: d.receiverCityCode,
      },
    ]) {
      const code = participantCode(party.doc);
      if (!code || map.has(code)) continue;
      const docs = partyDocFields(party.doc);
      // 0150: REG COD_PART NOME COD_PAIS CNPJ CPF IE COD_MUN SUFRAMA END NUM COMPL BAIRRO (13)
      map.set(code, {
        type: "0150",
        fields: [
          "0150",
          code,
          party.name || "",
          "1058",
          docs.cnpj,
          docs.cpf,
          onlyDigits(party.ie),
          party.mun || "",
          "", // SUFRAMA
          "", // END
          "", // NUM
          "", // COMPL
          "", // BAIRRO
        ],
        lineage: [
          {
            record: "0150",
            field: "COD_PART",
            value: code,
            sourceType: "derived",
            sourceRef: d.id,
            transformation: "P{CNPJ|CPF}",
            ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_0150`,
          },
        ],
      });
    }
  }
  return [...map.values()];
}

function build0200(ctx: ObligationContext): ObligationRecord[] {
  const map = new Map<string, ObligationRecord>();
  for (const d of ctx.documents) {
    for (const item of d.items) {
      const code = item.code || `ITEM${item.itemNumber}`;
      if (map.has(code)) continue;
      // 0200: … ALIQ_ICMS CEST (13 campos desde 2017)
      map.set(code, {
        type: "0200",
        fields: [
          "0200",
          code,
          item.description || "",
          "", // COD_BARRA
          "", // COD_ANT_ITEM (não preencher — usar 0205)
          item.unit || "",
          "00", // TIPO_ITEM — revisar com contador
          item.ncm || "",
          "", // EX_IPI
          "", // COD_GEN
          "", // COD_LST
          "", // ALIQ_ICMS
          "", // CEST
        ],
        lineage: [
          {
            record: "0200",
            field: "COD_ITEM",
            value: code,
            sourceType: "xml",
            sourceRef: d.id,
            xmlPath: "det/prod/cProd",
            ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_0200`,
            transformation: "TIPO_ITEM=00 requires accountant confirmation for production use",
          },
        ],
      });
    }
  }
  return [...map.values()];
}

/** CST/CSOSN ICMS no C170/C190: N 003* */
function cstIcms3(item: ObligationContext["documents"][0]["items"][0]): string {
  const raw = onlyDigits(item.tax.icms.cst || item.tax.icms.csosn || "");
  if (!raw) return "";
  return raw.padStart(3, "0").slice(-3);
}

function buildC100Family(ctx: ObligationContext): ObligationRecord[] {
  const out: ObligationRecord[] = [];
  for (const d of ctx.documents) {
    if (!(d.documentType === "NFE" || d.model === "55")) continue;
    const indOper = d.indOper || (d.cfopMain?.startsWith("5") || d.cfopMain?.startsWith("6") ? "1" : "0");
    const indEmit = d.indEmit || "0";
    const codPart = participantCode(indEmit === "0" ? d.receiverDoc : d.emitterDoc);
    const tot = d.icmsTot || {};
    const c100: ObligationRecord = {
      type: "C100",
      fields: [
        "C100",
        indOper,
        indEmit,
        codPart,
        d.model || "55",
        d.codSit || "00",
        d.series || "",
        d.number || "",
        d.accessKey || "",
        dateEfd(d.issueDate),
        dateEfd(d.issueDate),
        moneyToEfd(d.totalValue || "0"),
        "0", // IND_PGTO
        moneyToEfd(d.discountValue || tot.vDesc || "0"),
        "0", // VL_ABAT_NT
        moneyToEfd(d.productsValue || tot.vProd || "0"),
        "9", // IND_FRT
        moneyToEfd(d.freightValue || tot.vFrete || "0"),
        moneyToEfd(tot.vSeg || "0"),
        moneyToEfd(tot.vOutro || "0"),
        moneyToEfd(tot.vBC || "0"),
        moneyToEfd(tot.vICMS || "0"),
        moneyToEfd(tot.vBCST || "0"),
        moneyToEfd(tot.vST || "0"),
        moneyToEfd(tot.vIPI || "0"),
        moneyToEfd(tot.vPIS || "0"),
        moneyToEfd(tot.vCOFINS || "0"),
        "0", // VL_PIS_ST
        "0", // VL_COFINS_ST
      ],
      lineage: [
        {
          record: "C100",
          field: "VL_DOC",
          value: moneyToFixed(d.totalValue || "0"),
          sourceType: "xml",
          sourceRef: d.id,
          xmlPath: d.xmlPathHints?.vNF || "ICMSTot/vNF",
          ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_C100_VL_DOC`,
        },
      ],
      children: [],
    };

    const c190Map = new Map<
      string,
      { cst: string; cfop: string; aliq: string; vlOpr: string; vlBc: string; vlIcms: string; vlIpi: string }
    >();

    for (const item of d.items) {
      const cst = cstIcms3(item);
      const cfop = onlyDigits(item.cfop || "").slice(0, 4);
      const aliq = moneyToFixed(item.tax.icms.pIcms);
      // C170 — 38 campos (Guia Prático; campo 38 VL_ABAT_NT desde 2019)
      const c170: ObligationRecord = {
        type: "C170",
        fields: [
          "C170",
          String(item.itemNumber),
          item.code || "",
          item.description || "",
          moneyToEfd(item.quantity || "0", 5),
          item.unit || "",
          moneyToEfd(item.totalValue || "0"),
          moneyToEfd(item.discountValue || "0"),
          "0", // IND_MOV
          cst,
          cfop,
          "", // COD_NAT
          moneyToEfd(item.tax.icms.vBc),
          moneyToEfd(item.tax.icms.pIcms),
          moneyToEfd(item.tax.icms.vIcms),
          moneyToEfd(item.tax.icms.vBcSt),
          "0", // ALIQ_ST
          moneyToEfd(item.tax.icms.vIcmsSt),
          "0", // IND_APUR
          item.tax.ipi.cst || "",
          "", // COD_ENQ
          moneyToEfd(item.tax.ipi.vBc),
          moneyToEfd(item.tax.ipi.pIpi),
          moneyToEfd(item.tax.ipi.vIpi),
          item.tax.pis.cst || "",
          moneyToEfd(item.tax.pis.vBc),
          moneyToEfd(item.tax.pis.pAliq, 4),
          "", // QUANT_BC_PIS
          "", // ALIQ_PIS em R$
          moneyToEfd(item.tax.pis.vValor),
          item.tax.cofins.cst || "",
          moneyToEfd(item.tax.cofins.vBc),
          moneyToEfd(item.tax.cofins.pAliq, 4),
          "", // QUANT_BC_COFINS
          "", // ALIQ_COFINS em R$
          moneyToEfd(item.tax.cofins.vValor),
          "", // COD_CTA
          "0", // VL_ABAT_NT
        ],
        lineage: [
          {
            record: "C170",
            field: "VL_ICMS",
            value: item.tax.icms.vIcms,
            sourceType: "xml",
            sourceRef: d.id,
            xmlPath: "det/imposto/ICMS/*/vICMS",
            ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_C170_VL_ICMS`,
          },
        ],
      };
      c100.children!.push(c170);

      const key = `${cst}|${cfop}|${aliq}`;
      const agg = c190Map.get(key) || {
        cst,
        cfop,
        aliq,
        vlOpr: "0",
        vlBc: "0",
        vlIcms: "0",
        vlIpi: "0",
      };
      agg.vlOpr = moneyToFixed(moneyAdd(agg.vlOpr, item.totalValue));
      agg.vlBc = moneyToFixed(moneyAdd(agg.vlBc, item.tax.icms.vBc));
      agg.vlIcms = moneyToFixed(moneyAdd(agg.vlIcms, item.tax.icms.vIcms));
      agg.vlIpi = moneyToFixed(moneyAdd(agg.vlIpi, item.tax.ipi.vIpi));
      c190Map.set(key, agg);
    }

    for (const agg of c190Map.values()) {
      // C190: 11 campos
      c100.children!.push({
        type: "C190",
        fields: [
          "C190",
          agg.cst,
          agg.cfop,
          moneyToEfd(agg.aliq),
          moneyToEfd(agg.vlOpr),
          moneyToEfd(agg.vlBc),
          moneyToEfd(agg.vlIcms),
          "0",
          "0",
          "0",
          moneyToEfd(agg.vlIpi),
        ],
        lineage: [
          {
            record: "C190",
            field: "VL_OPR",
            value: agg.vlOpr,
            sourceType: "derived",
            sourceRef: d.id,
            transformation: "sum(C170.VL_ITEM) by CST/CFOP/ALIQ",
            ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_C190`,
          },
        ],
      });
    }

    out.push(c100);
  }
  return out;
}

function flattenRecords(records: ObligationRecord[]): ObligationRecord[] {
  const out: ObligationRecord[] = [];
  for (const r of records) {
    out.push(r);
    if (r.children?.length) out.push(...flattenRecords(r.children));
  }
  return out;
}

export async function buildEfdIcmsIpi(context: ObligationContext): Promise<ObligationBuildResult> {
  const readiness = detectEfdRequiredData(context);
  if (!readiness.canGenerate) {
    throw new Error(
      `Geração bloqueada: ${readiness.blockingCount} pendência(s) estrutural(is). Use detectRequiredData.`,
    );
  }

  const warnings: string[] = [
    `COD_VER=${efdIcmsIpiCodVer(context.periodEnd)} derivado do ano de DT_FIN (conferir tabela do Ato COTEPE no PVA).`,
    "COD_MUN/IM vazios no 0000 — completar cadastro do estabelecimento antes de transmitir.",
    "TIPO_ITEM=00 em 0200 exige confirmação do contador para uso em produção.",
    "IND_FRT=9 quando frete não informado — revise.",
    "E110 não gerado automaticamente neste MVP — apuração exige módulo dedicado.",
    "Arquivo destinado à pré-validação interna e importação no PVA oficial.",
  ];

  const bloco0: ObligationRecord[] = [build0000(context), { type: "0001", fields: ["0001", "0"] }];

  if (context.accountantName && context.accountantCpf) {
    // 0100: REG NOME CPF CRC CNPJ CEP END NUM COMPL BAIRRO FONE FAX EMAIL COD_MUN (14)
    bloco0.push({
      type: "0100",
      fields: [
        "0100",
        context.accountantName,
        onlyDigits(context.accountantCpf),
        "", // CRC
        "", // CNPJ escritório
        "", // CEP
        "", // END
        "", // NUM
        "", // COMPL
        "", // BAIRRO
        "", // FONE
        "", // FAX
        "", // EMAIL
        "", // COD_MUN
      ],
    });
  }

  bloco0.push(...build0150(context));
  const units = new Set(
    context.documents.flatMap((d) => d.items.map((i) => i.unit || "UN")).filter(Boolean),
  );
  for (const u of units) {
    bloco0.push({ type: "0190", fields: ["0190", u!, u!] });
  }
  bloco0.push(...build0200(context));
  bloco0.push({ type: "0990", fields: ["0990", String(bloco0.length + 1)] });

  const cFamily = buildC100Family(context);
  const cFlat = flattenRecords(cFamily);
  const blocoC: ObligationRecord[] = [
    { type: "C001", fields: ["C001", cFlat.length ? "0" : "1"] },
    ...cFlat,
  ];
  blocoC.push({ type: "C990", fields: ["C990", String(blocoC.length + 1)] });

  const body = [...bloco0, ...blocoC];
  const counts = new Map<string, number>();
  for (const r of body) counts.set(r.type, (counts.get(r.type) || 0) + 1);

  const bloco9: ObligationRecord[] = [{ type: "9001", fields: ["9001", "0"] }];
  for (const [reg, qtd] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    bloco9.push({ type: "9900", fields: ["9900", reg, String(qtd)] });
  }
  // Self-referential counters for bloco 9 regs — approximate deterministic set
  const extra9900 = ["9001", "9900", "9990", "9999"];
  for (const reg of extra9900) {
    const qtd =
      reg === "9900"
        ? counts.size + extra9900.length
        : 1;
    bloco9.push({ type: "9900", fields: ["9900", reg, String(qtd)] });
  }
  bloco9.push({ type: "9990", fields: ["9990", String(bloco9.length + 2)] });
  const all = [...body, ...bloco9];
  bloco9.push({ type: "9999", fields: ["9999", String(all.length + 1)] });

  const records = [...body, ...bloco9];
  const lineage = records.flatMap((r) => r.lineage || []);

  return {
    obligationId: "efd-icms-ipi",
    layoutVersion: context.layoutVersion,
    records,
    lineage,
    warnings,
  };
}

export async function validateEfdBuild(
  build: ObligationBuildResult,
): Promise<ValidationResult> {
  const issues: ValidationResult["issues"] = [];
  const types = build.records.map((r) => r.type);
  if (!types.includes("0000")) {
    issues.push({ code: "EFD_MISSING_0000", severity: "error", message: "Registro 0000 ausente" });
  }
  if (!types.includes("9999")) {
    issues.push({ code: "EFD_MISSING_9999", severity: "error", message: "Registro 9999 ausente" });
  }
  for (const w of build.warnings) {
    issues.push({ code: "EFD_BUILD_WARNING", severity: "warning", message: w });
  }
  // hierarchy: C170 must follow a C100 in flattened list — soft check
  let sawC100 = false;
  for (const r of build.records) {
    if (r.type === "C100") sawC100 = true;
    if (r.type === "C170" && !sawC100) {
      issues.push({
        code: "EFD_C170_ORPHAN",
        severity: "error",
        record: "C170",
        message: "C170 sem C100 precedente",
      });
    }
    if (r.type === "C990") sawC100 = false;
  }
  return { level: 1, ok: !issues.some((i) => i.severity === "error"), issues };
}

export async function serializeEfd(
  build: ObligationBuildResult,
): Promise<SerializedObligation> {
  const lines = build.records.map((r) => pipe(r.fields));
  const content = lines.join("\r\n") + "\r\n";
  const contentHash = await sha256Hex(content);
  return {
    encoding: "utf-8",
    lineEnding: "\r\n",
    content,
    contentHash,
    recordCount: build.records.length,
  };
}

export async function createEfdManifest(
  build: ObligationBuildResult,
  serialized: SerializedObligation,
  context: ObligationContext,
  validation: ValidationResult,
): Promise<GenerationManifest> {
  return {
    obligationId: "efd-icms-ipi",
    layoutVersion: build.layoutVersion,
    periodStart: context.periodStart,
    periodEnd: context.periodEnd,
    establishmentId: context.establishmentId,
    contentHash: serialized.contentHash,
    generatedAt: new Date().toISOString(),
    warnings: build.warnings,
    validationLevel: validation.level,
    disclaimer:
      "Pré-validação interna apenas. Não substitui o PVA oficial, assinatura ou transmissão. Não constitui parecer fiscal.",
  };
}

export const efdIcmsIpiPlugin: FiscalObligationPlugin = {
  id: "efd-icms-ipi",
  name: "EFD ICMS/IPI (SPED Fiscal)",
  jurisdiction: "federal",
  supportedVersions: [EFD_ICMS_IPI_LAYOUT_2026],
  async resolveVersion(context) {
    // Period-aware stub: always return registered draft until official_sources filled
    void context;
    return { layoutVersion: EFD_ICMS_IPI_LAYOUT_2026, sourceId: EFD_SOURCE_ID };
  },
  async detectRequiredData(context) {
    return detectEfdRequiredData(context);
  },
  async build(context) {
    return buildEfdIcmsIpi(context);
  },
  async validate(build) {
    return validateEfdBuild(build);
  },
  async serialize(build) {
    return serializeEfd(build);
  },
  async createManifest(build, serialized, context, validation) {
    return createEfdManifest(build, serialized, context, validation);
  },
};
