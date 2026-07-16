import type {
  ObligationContext,
  ObligationRecord,
  RequiredDataResult,
  ReadinessStatus,
  LineageEntry,
  ObligationBuildResult,
} from "@/modules/obligations/core/types";
import { money, moneyAdd, moneyToEfd, moneyToFixed, Money } from "@/lib/money/decimal";
import { EFD_ICMS_IPI_LAYOUT_2026, efdIcmsIpiCodVer } from "@/modules/obligations/efd-icms-ipi/constants";
import {
  onlyDigits,
  efdCnpj,
  efdSanitize,
  efdUnid,
  efdNcm,
  dateEfd,
  partyDocFields,
  participantCode,
  resolveIndEmit,
  resolveCodSit,
  cstIcms3,
} from "@/modules/obligations/efd-icms-ipi/common";
import { buildE110FromC190, buildE116IfNeeded } from "@/modules/obligations/efd-icms-ipi/calculations";
import { getEfdUfPlugin } from "@/modules/obligations/efd-icms-ipi/uf/registry";
import { cnpjFromAccessKey } from "@/modules/obligations/efd-icms-ipi/suggest-informant";

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
    if (!(d.documentType === "NFE" || d.model === "55")) continue;
    // Só o CONTRAPARTE (o outro lado da operação) vira 0150 — o estabelecimento
    // informante NÃO entra em 0150 (é identificado no 0000). Isso espelha exatamente
    // o COD_PART do C100, evitando 0150 órfão no PVA.
    const indEmit = resolveIndEmit(ctx, d);
    const party =
      indEmit === "0"
        ? {
            doc: d.receiverDoc,
            name: d.receiverName,
            ie: d.receiverIe,
            uf: d.receiverUf,
            mun: d.receiverCityCode,
            end: d.receiverAddress,
            num: d.receiverAddressNumber,
            compl: d.receiverAddressCompl,
            bairro: d.receiverNeighborhood,
          }
        : {
            doc: d.emitterDoc,
            name: d.emitterName,
            ie: d.emitterIe,
            uf: d.emitterUf,
            mun: d.emitterCityCode,
            end: d.emitterAddress,
            num: d.emitterAddressNumber,
            compl: d.emitterAddressCompl,
            bairro: d.emitterNeighborhood,
          };
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

/** Mapa natOp (descrição) → código Nxxx, na ordem dos documentos NF-e. Compartilhado por 0400 e C170. */
function computeNatMap(ctx: ObligationContext): Map<string, string> {
  const map = new Map<string, string>();
  let seq = 1;
  for (const d of ctx.documents) {
    if (!(d.documentType === "NFE" || d.model === "55")) continue;
    const desc = (d.natureOperation || "").trim();
    if (!desc || map.has(desc)) continue;
    map.set(desc, `N${String(seq).padStart(3, "0")}`);
    seq += 1;
  }
  return map;
}

/** 0400 — naturezas de operação únicas do lote (COD_NAT / DESCR_NAT). */
function build0400(ctx: ObligationContext): ObligationRecord[] {
  const natMap = computeNatMap(ctx);
  const out: ObligationRecord[] = [];
  for (const [desc, cod] of natMap) {
    out.push({
      type: "0400",
      fields: ["0400", efdSanitize(cod, 10), efdSanitize(desc, 60)],
      lineage: [
        {
          record: "0400",
          field: "DESCR_NAT",
          value: desc,
          sourceType: "xml",
          sourceRef: ctx.establishmentId,
          xmlPath: "ide/natOp",
          ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_0400`,
        },
      ],
    });
  }
  return out;
}

function buildC100Family(ctx: ObligationContext): ObligationRecord[] {
  const out: ObligationRecord[] = [];
  const natMap = computeNatMap(ctx);
  for (const d of ctx.documents) {
    if (!(d.documentType === "NFE" || d.model === "55")) continue;
    const indEmit = resolveIndEmit(ctx, d);
    // Documento emitido por terceiros (IND_EMIT=1) sempre é entrada (IND_OPER=0).
    const indOper =
      indEmit === "1"
        ? "0"
        : d.indOper || (d.cfopMain?.startsWith("5") || d.cfopMain?.startsWith("6") ? "1" : "0");
    const codPart = participantCode(indEmit === "0" ? d.receiverDoc : d.emitterDoc);
    const tot = d.icmsTot || {};
    const codSit = resolveCodSit(d);
    const c100: ObligationRecord = {
      type: "C100",
      fields: [
        "C100",
        indOper,
        indEmit,
        codPart,
        d.model || "55",
        codSit,
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
        {
          record: "C100",
          field: "COD_SIT",
          value: codSit,
          sourceType: d.codSit ? "manual" : "derived",
          sourceRef: d.id,
          ruleId: `${EFD_ICMS_IPI_LAYOUT_2026}_C100_COD_SIT`,
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
      // C170 detalha o item e é filho obrigatório do C100 para NF-e (Guia 3.2.2).
      // Ausência gera "Registro filho obrigatório" e deixa 0200/0400 órfãos no PVA.
      const itemCode = item.code || `ITEM${item.itemNumber}`;
      const c170: ObligationRecord = {
        type: "C170",
        fields: [
          "C170",
          String(item.itemNumber), // 02 NUM_ITEM
          efdSanitize(itemCode, 60), // 03 COD_ITEM
          efdSanitize(item.description || "", 255), // 04 DESCR_COMPL
          moneyToEfd(item.quantity || "0", 5), // 05 QTD
          efdUnid(item.unit), // 06 UNID
          moneyToEfd(item.totalValue || "0"), // 07 VL_ITEM
          moneyToEfd(item.discountValue || "0"), // 08 VL_DESC
          "0", // 09 IND_MOV
          cst, // 10 CST_ICMS
          cfop, // 11 CFOP
          natMap.get((d.natureOperation || "").trim()) || "", // 12 COD_NAT
          moneyToEfd(item.tax.icms.vBc), // 13 VL_BC_ICMS
          moneyToEfd(item.tax.icms.pIcms), // 14 ALIQ_ICMS
          moneyToEfd(item.tax.icms.vIcms), // 15 VL_ICMS
          moneyToEfd(item.tax.icms.vBcSt), // 16 VL_BC_ICMS_ST
          moneyToEfd((item.tax.icms as Record<string, string | undefined>).pIcmsSt || "0"), // 17 ALIQ_ST
          moneyToEfd(item.tax.icms.vIcmsSt), // 18 VL_ICMS_ST
          "0", // 19 IND_APUR
          item.tax.ipi.cst || "", // 20 CST_IPI
          efdSanitize((item.tax.ipi as Record<string, string | undefined>).codEnq || "", 3), // 21 COD_ENQ
          moneyToEfd(item.tax.ipi.vIpi), // 22 VL_IPI
          item.tax.pis.cst || "", // 25 CST_PIS
          moneyToEfd(item.tax.pis.vBc), // 26 VL_BC_PIS
          moneyToEfd(item.tax.pis.pAliq, 4), // 27 ALIQ_PIS
          "", // 28 QUANT_BC_PIS
          moneyToEfd(item.tax.pis.vValor), // 29 VL_PIS
          item.tax.cofins.cst || "", // 30 CST_COFINS
          moneyToEfd(item.tax.cofins.vBc), // 31 VL_BC_COFINS
          moneyToEfd(item.tax.cofins.pAliq, 4), // 32 ALIQ_COFINS
          "", // 33 QUANT_BC_COFINS
          moneyToEfd(item.tax.cofins.vValor), // 34 VL_COFINS
          "", // 35 COD_CTA
          "", // 36 VL_ABAT_NT
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
      // C190 (leiaute 020): REG, CST_ICMS, CFOP, ALIQ_ICMS, VL_OPR, VL_BC_ICMS,
      // VL_ICMS, VL_BC_ICMS_ST, VL_ICMS_ST, VL_RED_BC, COD_OBS
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
    "C170 detalhado por item (filho obrigatório do C100 para NF-e no Guia 3.2.2) — referencia 0200/0400.",
    "Blocos B/G/H/K gerados vazios (IND_MOV=1) — inventário/CIAP/controle não preenchidos.",
    "Arquivo destinado à pré-validação interna e importação no PVA oficial.",
  ];
  if (!onlyDigits(context.codMun) || onlyDigits(context.codMun).length !== 7) {
    warnings.push("COD_MUN ausente/inválido no 0000 — obrigatório no Guia (7 dígitos IBGE).");
  }
  if (!onlyDigits(context.cep) || !context.address || !context.neighborhood) {
    warnings.push("0005 incompleto (CEP/END/BAIRRO obrigatórios) — complete o cadastro do estabelecimento.");
  }

  // Ordem Bloco 0: 0000 → 0001 → 0002? → 0005 → 0100? → 0150 → 0190 → 0200 → 0400 → 0990
  const bloco0: ObligationRecord[] = [build0000(context), { type: "0001", fields: ["0001", "0"] }];
  if (context.activityCode === "1") {
    // 0002 obrigatório para IND_ATIV=1 (industrial) — filho do 0001 (Tabela 4.5.5).
    // Leiaute 020 (NT 2025.001): REG + CLAS_ESTAB_IND (2 dígitos).
    bloco0.push({
      type: "0002",
      fields: ["0002", onlyDigits(context.industrialClass || "00").slice(0, 2)],
    });
  }
  bloco0.push(build0005(context));

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
        efdSanitize(context.accountantEmail || "", 60), // EMAIL (obrigatório PVA)
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
  const nat0400 = build0400(context);
  if (nat0400.length) {
    bloco0.push(...nat0400);
  } else {
    warnings.push("0400 omitido — nenhuma natureza da operação (natOp) nos documentos.");
  }
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
  const e110 = buildE110FromC190(cFlat, context.priorCreditBalance);
  const ufPlugin = getEfdUfPlugin(context.uf);
  const codRec =
    efdSanitize(context.icmsCodRec || "", 60) ||
    ufPlugin.suggestIcmsCodRec?.({ periodEnd: context.periodEnd }) ||
    "";
  const e116 = buildE116IfNeeded(e110, context, codRec);
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
  if (context.activityCode === "1") {
    // Contribuinte de IPI (IND_ATIV=1, industrial) deve apresentar E500 + E520 (apuração IPI).
    // E110 (ICMS) deve vir ANTES de E500 (IPI) na hierarquia do bloco E.
    // serializeEfd escreve só registros de topo; empurramos E500 e E520 direto.
    blocoE.push({
      type: "E500",
      fields: ["E500", "0", dateEfd(context.periodStart), dateEfd(context.periodEnd)],
    });
    blocoE.push({ type: "E520", fields: ["E520", "0", "0", "0", "0", "0", "0", "0"] });
  }
  blocoE.push({ type: "E990", fields: ["E990", String(blocoE.length + 1)] });
  if (context.priorCreditBalance) {
    warnings.push(
      `E110 VL_SLD_CREDOR_ANT=${context.priorCreditBalance} (informado manualmente — não inventado).`,
    );
  } else {
    warnings.push(
      "E110 gerado com totais derivados dos C190 (débitos/créditos ICMS). Saldo anterior/ajustes zerados — informe priorCreditBalance se houver.",
    );
  }
  if (e116 && !codRec) {
    warnings.push(
      `E116 gerado sem COD_REC — informe código estadual (UF ${context.uf || "??"}; tabela plugin vazia até fonte oficial).`,
    );
  }
  if (context.activityCode === "1") {
    warnings.push(
      "IND_ATIV=1 (industrial) — 0002 + E500/E520 gerados (apuração IPI zerada; ajuste se houver crédito/débito real).",
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
