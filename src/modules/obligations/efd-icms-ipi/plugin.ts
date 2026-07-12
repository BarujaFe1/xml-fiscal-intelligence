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
import { money, moneyAdd, moneyToEfd, moneyToFixed, Money } from "@/lib/money/decimal";
import { sha256Hex } from "@/lib/security/hash";
import { isCnpjShape, normalizeCnpj, normalizeCpf } from "@/lib/fiscal/cnpj";
import { cnpjFromAccessKey } from "@/modules/obligations/efd-icms-ipi/suggest-informant";

export const EFD_ICMS_IPI_LAYOUT_2026 = "EFD_ICMS_IPI_2026_DRAFT";
export const EFD_SOURCE_ID = "official:sped:efd-icms-ipi:pending-registry";

function onlyDigits(v?: string) {
  return (v || "").replace(/\D/g, "");
}

/** CNPJ for EFD: preserve alphanumeric; strip only mask punctuation. */
function efdCnpj(v?: string) {
  return normalizeCnpj(v);
}

/**
 * Text fields in pipe-delimited SPED cannot contain `|` or line breaks —
 * otherwise PVA reports "número de campos difere do layout".
 */
export function efdSanitize(v: string | undefined | null, maxLen?: number): string {
  let s = String(v ?? "")
    .replace(/\|/g, "/")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (maxLen != null && maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function pipe(fields: Array<string | undefined | null>): string {
  return `|${fields.map((f) => efdSanitize(f === undefined || f === null ? "" : String(f))).join("|")}|`;
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

function efdUnid(v?: string): string {
  const u = efdSanitize(v || "UN", 6);
  return u || "UN";
}

function efdNcm(v?: string): string {
  const d = onlyDigits(v);
  return d.length === 8 ? d : "";
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

function chaveInformanteStatus(ctx: ObligationContext): ReadinessStatus {
  const informante = efdCnpj(ctx.cnpj);
  if (!informante) return "review";
  let own = 0;
  let other = 0;
  for (const d of ctx.documents) {
    const chaveCnpj = cnpjFromAccessKey(d.accessKey) || efdCnpj(d.emitterDoc);
    if (!chaveCnpj) continue;
    if (chaveCnpj === informante) own += 1;
    else other += 1;
  }
  if (own === 0 && other > 0) return "review";
  return "complete";
}

function resolveIndEmit(
  ctx: ObligationContext,
  d: ObligationContext["documents"][0],
): "0" | "1" {
  if (d.indEmit === "0" || d.indEmit === "1") return d.indEmit;
  const informante = efdCnpj(ctx.cnpj);
  const emit = efdCnpj(d.emitterDoc) || cnpjFromAccessKey(d.accessKey);
  if (informante && emit) return informante === emit ? "0" : "1";
  return "0";
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
      status: (context.accountantName && context.accountantCpf && context.accountantCrc
        ? "complete"
        : "review") as ReadinessStatus,
      message: "0100 só é gerado com NOME+CPF+CRC (CRC obrigatório no Guia)",
    },
    {
      id: "chave_informante",
      label: "CNPJ informante × chaves NF-e",
      status: chaveInformanteStatus(context),
      message:
        "CNPJ do 0000 deve coincidir com o CNPJ da chave nas NF-e de emissão própria — use «Usar emitente do lote»",
      remediation: "Alinhe o CNPJ/UF do estabelecimento ao emitente predominante do ZIP",
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
      label: "Blocos B/G/H/K",
      status: "complete" as ReadinessStatus,
      message: "Gerados vazios (IND_MOV=1) conforme Guia — inventário/CIAP/controle fora do rascunho.",
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
    efdSanitize(ctx.companyName, 100),
    efdCnpj(ctx.cnpj),
    "", // CPF
    efdSanitize(ctx.uf, 2),
    onlyDigits(ctx.ie),
    onlyDigits(ctx.codMun).slice(0, 7), // COD_MUN
    "", // IM
    "", // SUFRAMA
    efdSanitize(ctx.profile || "", 1),
    efdSanitize(ctx.activityCode || "", 1),
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

/** 0005 obrigatório (Guia Prático) — 10 campos. */
function build0005(ctx: ObligationContext): ObligationRecord {
  const fantasia = efdSanitize(ctx.tradeName || ctx.companyName, 60);
  return {
    type: "0005",
    fields: [
      "0005",
      fantasia,
      onlyDigits(ctx.cep).slice(0, 8),
      efdSanitize(ctx.address, 60),
      efdSanitize(ctx.addressNumber, 10),
      efdSanitize(ctx.addressCompl, 60),
      efdSanitize(ctx.neighborhood, 60),
      onlyDigits(ctx.phone).slice(0, 11),
      "", // FAX
      efdSanitize(ctx.email, 255),
    ],
  };
}

function emptyBlock(prefix: "B" | "G" | "H" | "K"): ObligationRecord[] {
  const open = `${prefix}001`;
  const close = `${prefix}990`;
  return [
    { type: open, fields: [open, "1"] },
    { type: close, fields: [close, "2"] },
  ];
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
        end: d.emitterAddress,
        num: d.emitterAddressNumber,
        compl: d.emitterAddressCompl,
        bairro: d.emitterNeighborhood,
      },
      {
        doc: d.receiverDoc,
        name: d.receiverName,
        ie: d.receiverIe,
        uf: d.receiverUf,
        mun: d.receiverCityCode,
        end: d.receiverAddress,
        num: d.receiverAddressNumber,
        compl: d.receiverAddressCompl,
        bairro: d.receiverNeighborhood,
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
          efdSanitize(party.name || "", 100),
          "1058",
          docs.cnpj,
          docs.cpf,
          onlyDigits(party.ie),
          onlyDigits(party.mun).slice(0, 7),
          "", // SUFRAMA
          efdSanitize(party.end || "NAO INFORMADO", 60),
          efdSanitize(party.num, 10),
          efdSanitize(party.compl, 60),
          efdSanitize(party.bairro || "NAO INFORMADO", 60),
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
          efdSanitize(code, 60),
          efdSanitize(item.description || "", 255),
          "", // COD_BARRA
          "", // COD_ANT_ITEM (não preencher — usar 0205)
          efdUnid(item.unit),
          "00", // TIPO_ITEM — revisar com contador
          efdNcm(item.ncm),
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
    const indEmit = resolveIndEmit(ctx, d);
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
      // C170 é facultativo para NF-e/NFC-e com chave — omitir evita centenas de erros de item no PVA
      // quando o XML eletrônico já detalha o documento (Guia Prático).
      const isElectronic =
        d.model === "55" ||
        d.model === "65" ||
        d.documentType === "NFE" ||
        d.documentType === "NFCE" ||
        Boolean(d.accessKey);
      if (!isElectronic) {
        const c170: ObligationRecord = {
          type: "C170",
          fields: [
            "C170",
            String(item.itemNumber),
            efdSanitize(item.code || "", 60),
            efdSanitize(item.description || "", 255),
            moneyToEfd(item.quantity || "0", 5),
            efdUnid(item.unit),
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
      }

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
      // C190: 12 campos (Guia 3.2.3) — inclui COD_OBS
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
          "0", // VL_BC_ICMS_ST
          "0", // VL_ICMS_ST
          "0", // VL_RED_BC
          moneyToEfd(agg.vlIpi),
          "", // COD_OBS
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
    "TIPO_ITEM=00 em 0200 exige confirmação do contador para uso em produção.",
    "IND_FRT=9 quando frete não informado — revise.",
    "C170 omitido para NF-e/NFC-e (facultativo no Guia quando há chave de acesso) — detalhe do item no XML.",
    "Blocos B/G/H/K gerados vazios (IND_MOV=1) — inventário/CIAP/controle não preenchidos.",
    "Arquivo destinado à pré-validação interna e importação no PVA oficial.",
  ];
  if (!onlyDigits(context.codMun) || onlyDigits(context.codMun).length !== 7) {
    warnings.push("COD_MUN ausente/inválido no 0000 — obrigatório no Guia (7 dígitos IBGE).");
  }
  if (!onlyDigits(context.cep) || !context.address || !context.neighborhood) {
    warnings.push("0005 incompleto (CEP/END/BAIRRO obrigatórios) — complete o cadastro do estabelecimento.");
  }

  // Ordem Bloco 0: 0000 → 0001 → 0005 → 0100? → 0150 → 0190 → 0200 → 0990
  const bloco0: ObligationRecord[] = [
    build0000(context),
    { type: "0001", fields: ["0001", "0"] },
    build0005(context),
  ];

  if (context.accountantName && context.accountantCpf && context.accountantCrc) {
    // 0100: REG NOME CPF CRC CNPJ CEP END NUM COMPL BAIRRO FONE FAX EMAIL COD_MUN (14)
    bloco0.push({
      type: "0100",
      fields: [
        "0100",
        context.accountantName,
        onlyDigits(context.accountantCpf),
        efdSanitize(context.accountantCrc, 15),
        "", // CNPJ escritório
        "", // CEP
        "", // END
        "", // NUM
        "", // COMPL
        "", // BAIRRO
        "", // FONE
        "", // FAX
        "", // EMAIL
        onlyDigits(context.codMun).slice(0, 7), // COD_MUN
      ],
    });
  } else if (context.accountantName || context.accountantCpf) {
    warnings.push(
      "0100 omitido: CRC do contabilista é obrigatório no Guia — informe CRC para gerar o registro.",
    );
  }

  bloco0.push(...build0150(context));
  const units = new Set(
    context.documents.flatMap((d) => d.items.map((i) => i.unit || "UN")).filter(Boolean),
  );
  for (const u of units) {
    const unid = efdUnid(u);
    bloco0.push({ type: "0190", fields: ["0190", unid, unid] });
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

  // Ordem oficial dos blocos: 0 → B → C → D → E → G → H → K → 1 → 9
  const blocoB = emptyBlock("B");
  const blocoD: ObligationRecord[] = [
    { type: "D001", fields: ["D001", "1"] },
    { type: "D990", fields: ["D990", "2"] },
  ];

  // Bloco E — obrigatório; E110 com totais derivados dos C190 (não é parecer fiscal)
  const e110 = buildE110FromC190(cFlat);
  const e116 = buildE116IfNeeded(e110, context);
  const blocoE: ObligationRecord[] = [
    { type: "E001", fields: ["E001", "0"] },
    {
      type: "E100",
      fields: ["E100", dateEfd(context.periodStart), dateEfd(context.periodEnd)],
    },
    e110,
  ];
  if (e116) {
    e110.children = [e116];
    blocoE.push(e116);
  }
  blocoE.push({ type: "E990", fields: ["E990", String(blocoE.length + 1)] });
  warnings.push(
    "E110 gerado com totais derivados dos C190 (débitos/créditos ICMS). Saldo anterior/ajustes zerados — conferir e completar no PVA.",
  );
  if (e116 && !context.icmsCodRec) {
    warnings.push(
      "E116 gerado sem COD_REC (código de receita da UF) — preencha o código estadual antes de transmitir.",
    );
  }
  if (context.activityCode === "0") {
    warnings.push(
      "IND_ATIV=0 (industrial) exige E500/IPI no PVA — este rascunho não gera E500. Use IND_ATIV=1 se não for industrial.",
    );
  }

  const blocoG = emptyBlock("G");
  const blocoH = emptyBlock("H");
  const blocoK = emptyBlock("K");

  // Bloco 1 — 1010 obrigatório (todas as respostas N neste rascunho)
  const bloco1: ObligationRecord[] = [
    { type: "1001", fields: ["1001", "0"] },
    {
      type: "1010",
      fields: [
        "1010",
        "N", // IND_EXP
        "N", // IND_CCRF
        "N", // IND_COMB
        "N", // IND_USINA
        "N", // IND_VA
        "N", // IND_EE
        "N", // IND_CART
        "N", // IND_FORM
        "N", // IND_AER
        "N", // IND_GIAF1
        "N", // IND_GIAF3
        "N", // IND_GIAF4
        "N", // IND_REST_RESSARC_COMPL_ICMS
      ],
    },
    { type: "1990", fields: ["1990", "3"] },
  ];

  const body = [
    ...bloco0,
    ...blocoB,
    ...blocoC,
    ...blocoD,
    ...blocoE,
    ...blocoG,
    ...blocoH,
    ...blocoK,
    ...bloco1,
  ];
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

/**
 * E110 (15 campos). Débitos/créditos = soma VL_ICMS dos C190 por IND_OPER do C100 pai.
 * Ajustes e saldo anterior = 0 (exigem input manual / período anterior).
 */
function buildE110FromC190(cFlat: ObligationRecord[]): ObligationRecord {
  let debits = money("0");
  let credits = money("0");
  let currentIndOper = "0";
  for (const r of cFlat) {
    if (r.type === "C100") {
      currentIndOper = r.fields[1] || "0"; // IND_OPER
      continue;
    }
    if (r.type !== "C190") continue;
    // C190: REG CST CFOP ALIQ VL_OPR VL_BC VL_ICMS ...
    const vlIcms = r.fields[6] || "0";
    if (currentIndOper === "1") debits = debits.plus(money(vlIcms));
    else credits = credits.plus(money(vlIcms));
  }
  const z = "0,00";
  const vlDeb = moneyToEfd(debits);
  const vlCred = moneyToEfd(credits);
  const diff = debits.scaled - credits.scaled; // VL_SLD_CREDOR_ANT = 0
  const sldApurado = diff > 0n ? moneyToEfd(new Money(diff)) : z;
  const sldTransp = diff < 0n ? moneyToEfd(new Money(-diff)) : z;
  return {
    type: "E110",
    fields: [
      "E110",
      vlDeb, // 02 VL_TOT_DEBITOS
      z, // 03 VL_AJ_DEBITOS
      z, // 04 VL_TOT_AJ_DEBITOS
      z, // 05 VL_ESTORNOS_CRED
      vlCred, // 06 VL_TOT_CREDITOS
      z, // 07 VL_AJ_CREDITOS
      z, // 08 VL_TOT_AJ_CREDITOS
      z, // 09 VL_ESTORNOS_DEB
      z, // 10 VL_SLD_CREDOR_ANT
      sldApurado, // 11 VL_SLD_APURADO
      z, // 12 VL_TOT_DED
      sldApurado, // 13 VL_ICMS_RECOLHER (deduções 0)
      sldTransp, // 14 VL_SLD_CREDOR_TRANSPORTAR
      z, // 15 DEB_ESP
    ],
  };
}

/** E116 obrigatório quando VL_ICMS_RECOLHER + DEB_ESP > 0 (Guia). */
function buildE116IfNeeded(
  e110: ObligationRecord,
  ctx: ObligationContext,
): ObligationRecord | null {
  const vlRecolher = e110.fields[12] || "0,00";
  const debEsp = e110.fields[14] || "0,00";
  const total = money(vlRecolher).plus(money(debEsp));
  if (total.scaled <= 0n) return null;
  const mesRef = (ctx.periodEnd || "").slice(5, 7) + (ctx.periodEnd || "").slice(0, 4);
  return {
    type: "E116",
    fields: [
      "E116",
      "000", // COD_OR — ICMS a recolher
      moneyToEfd(total),
      dateEfd(ctx.periodEnd), // DT_VCTO — conferir legislação UF
      efdSanitize(ctx.icmsCodRec || "", 60), // COD_REC
      "", // NUM_PROC
      "", // IND_PROC
      "", // PROC
      "", // TXT_COMPL
      mesRef, // MES_REF mmaaaa
    ],
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
