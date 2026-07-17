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
  cstIcms,
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
  let ownIssue = 0; // NF-e próprias (emitente = informante)
  let ownMismatch = 0; // próprias com CNPJ da chave divergente
  let incoming = 0; // NF-e de terceiros (informante é destinatário) — esperado
  for (const d of ctx.documents) {
    const emitter = efdCnpj(d.emitterDoc);
    const chaveCnpj = cnpjFromAccessKey(d.accessKey) || emitter;
    if (!chaveCnpj) continue;
    if (emitter === informante) {
      ownIssue += 1;
      if (chaveCnpj !== informante) ownMismatch += 1;
    } else {
      incoming += 1;
    }
  }
  if (ownIssue === 0 && incoming === 0) return "review"; // nenhuma NF-e do informante no lote
  if (ownMismatch > 0) return "review"; // próprias com CNPJ divergente na chave → erro no PVA
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
      explanation:
        "O Registro 0000 identifica quem entrega o SPED. CNPJ, UF e IE devem ser exatamente os da empresa informante. Sem IE (quando a UF exige) ou com COD_MUN/endereço incompletos, o PVA reclama. O 0005 (dados de contato) também é obrigatório no Guia.",
      fix: "Preencha CNPJ (14 dígitos), UF (sigla) e IE. Informe também COD_MUN (código IBGE de 7 dígitos) no 0000 e CEP/Endereço/Bairro no 0005. Se a UF realmente não exige IE, pode ficar em branco — mas confira no cadastro da empresa (aba Empresas).",
    },
    {
      id: "period",
      label: "Período DT_INI/DT_FIN",
      status: (context.periodStart && context.periodEnd ? "complete" : "blocking") as ReadinessStatus,
      explanation:
        "Define o mês/ano do arquivo (Registro 0000, campos DT_INI/DT_FIN). Tem de abranger todas as NF-e do período. Data fora do prazo ou inconsistente faz o PVA recusar o arquivo.",
      fix: "Informe a data inicial e final do período (ex.: 01/06/2026 a 30/06/2026). Use o mesmo período do lote carregado.",
    },
    {
      id: "profile",
      label: "Perfil A/B/C",
      status: (context.profile ? "complete" : "blocking") as ReadinessStatus,
      remediation: "Informe o perfil SPED — não presumimos",
      explanation:
        "IND_PERFIL do 0000. Perfil A = industrial/comércio com apuração própria; B = atacadista; C = prestador de serviço sem ICMS. Define a obrigatoriedade de blocos. Não presumimos — você informa.",
      fix: "Selecione A, B ou C conforme o regime da empresa (ver quadro no Guia Prático 3.2.2). Na dúvida, pergunte ao contador.",
    },
    {
      id: "activity",
      label: "IND_ATIV",
      status: (context.activityCode !== undefined ? "complete" : "blocking") as ReadinessStatus,
      remediation: "Informe o indicador de atividade",
      explanation:
        "IND_ATIV do 0000 (0 = outro, 1 = industrial). IND_ATIV=0 gera o Registro 0002 (classe industrial). A apuração de IPI (E500/E520) é emitida automaticamente apenas quando há operação com IPI no período — empresa não contribuinte do IPI (ex.: cooperativa) não a apresenta.",
      fix: "Informe 0 ou 1 conforme a atividade (0 = outros; 1 = industrial/equiparado).",
    },
    {
      id: "purpose",
      label: "Finalidade do arquivo",
      status: (context.purpose !== undefined ? "complete" : "blocking") as ReadinessStatus,
      explanation:
        "COD_FIN do 0000 (0 = remessa regular, 1 = retificadora). É obrigatório: sem ele o arquivo nem monta. A retificadora exige também o número do recibo do arquivo original substituído.",
      fix: "Escolha 0 (entrega normal) ou 1 (retificação). Para retificação, anote o recibo do arquivo que está sendo substituído.",
    },
    {
      id: "accountant",
      label: "Contabilista (0100)",
      status: (context.accountantName && context.accountantCpf && context.accountantCrc && context.accountantEmail
        ? "complete"
        : "blocking") as ReadinessStatus,
      message: "0100 exige NOME + CPF + CRC + E-MAIL do contabilista (todos obrigatórios no PVA)",
      explanation:
        "O Registro 0100 (dados do contabilista responsável) é obrigatório no PVA. Todos os campos NOME, CPF, CRC e E-MAIL devem ser informados — sem eles o PVA acusa 'Registro filho obrigatório não foi informado'.",
      fix: "Preencha Nome, CPF, CRC (conselho de contabilidade) e E-mail do contabilista. O 0100 só é gerado quando os quatro campos estão preenchidos.",
    },
    {
      id: "chave_informante",
      label: "CNPJ informante × chaves NF-e",
      status: chaveInformanteStatus(context),
      message:
        "Geração é restrita ao CNPJ informante (formulário / empresa selecionada). NF-e próprias com CNPJ da chave divergente acusam erro no PVA.",
      remediation: "Alinhe o CNPJ/UF do estabelecimento ao emitente predominante do ZIP",
      explanation:
        "O CNPJ do 0000 deve ser o da empresa que emite as NF-e próprias do lote. Se o lote tiver NF-e de outro CNPJ (ou chaves com CNPJ diferente), o PVA acusa inconsistência de informante (erro de CNPJ/IE).",
      fix: "Clique em 'Usar emitente do lote' para preencher CNPJ/UF/IE com o emitente predominante. Mais seguro ainda: selecione a empresa cadastrada no topo e gere só as notas desse CNPJ (escopo automático por CNPJ).",
    },
    {
      id: "documents",
      label: "Documentos NF-e no período",
      status: (context.documents.some((d) => d.documentType === "NFE" || d.model === "55")
        ? "complete"
        : "blocking") as ReadinessStatus,
      explanation:
        "O SPED precisa de ao menos uma NF-e (modelo 55) no período. Sem documentos, não há C100/C170 e o arquivo fica vazio/inválido no PVA.",
      fix: "Carregue o lote (ZIP/XML) com as NF-e do período na tela de importação antes de gerar.",
    },
    {
      id: "document_status",
      label: "Status das NF-e (canceladas/denegadas)",
      status: ((context.excludedDocumentCount ?? 0) > 0 || (context.unknownStatusCount ?? 0) > 0 || (context.outOfPeriodCount ?? 0) > 0
        ? "review"
        : "complete") as ReadinessStatus,
      message:
        [
          (context.excludedDocumentCount ?? 0) > 0
            ? `${context.excludedDocumentCount} NF-e excluída(s) por status (cancelada/denegada/inutilizada/rejeitada).`
            : "",
          (context.unknownStatusCount ?? 0) > 0
            ? `${context.unknownStatusCount} NF-e sem status conhecido (XML sem protocolo de autorização).`
            : "",
          (context.outOfPeriodCount ?? 0) > 0
            ? `${context.outOfPeriodCount} NF-e fora do recorte de período (ignorada(s) por data).`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || undefined,
      explanation:
        "NF-e cancelada, denegada, inutilizada ou rejeitada NÃO devem entrar no SPED — incluí-las gera inconsistência e rejeição no PVA. O gerador já as exclui automaticamente quando o status vem no XML (protocolo de autorização). Além disso, só entram as NF-e cuja data de emissão está DENTRO do recorte de período escolhido (dia/semana/mês/semestre/intervalo) — as demais são ignoradas silenciosamente.",
      fix:
        (context.excludedDocumentCount ?? 0) > 0
          ? "Nada a fazer: essas notas foram excluídas da geração. Confira no portal da SEFAZ se a exclusão está correta."
          : (context.unknownStatusCount ?? 0) > 0
            ? "Importe o XML completo (nfeProc, com o protocolo de autorização) para que o status seja conferido. Sem protocolo, o status não pode ser verificado."
            : "Status conferido — só NF-e autorizadas entram no arquivo.",
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
      explanation:
        "Cada item de NF-e precisa de CST/CSOSN de ICMS para gerar C170/C190. Se faltar, o PVA reclama de registro filho obrigatório ausente ou CST inválido.",
      fix: "Normalize os impostos das NF-e (extraia CST/BC/alíquota do XML) antes de gerar. O processo de importação já faz isso; se algo ficou de fora, reimporte o lote.",
    },
    {
      id: "e110",
      label: "Apuração E110",
      status: (context.priorCreditBalance !== undefined ? "manual" : "review") as ReadinessStatus,
      message:
        "E110 não é soma silenciosa de XML. Informe saldo anterior ou marque N/A com justificativa no futuro.",
      explanation:
        "O E110 apura o ICMS do período. Débitos e créditos são calculados a partir dos C190 (que vêm das NF-e). MAS o saldo de períodos anteriores (VL_SLD_CREDOR_ANT) e os ajustes NÃO vêm do XML — têm de ser informados manualmente. Se ficarem zerados e não forem, o valor a recolher sai errado.",
      fix: "Informe o saldo credor anterior (campo 'saldo anterior') se a empresa tiver crédito acumulado. Ajustes de apuração também entram manualmente. Para um rascunho, fica zerado — confirme com o contador antes do envio oficial.",
    },
    {
      id: "e116_cod_rec",
      label: "E116 · COD_REC (código estadual do ICMS)",
      status: (context.icmsCodRec ? "complete" : "review") as ReadinessStatus,
      message: context.icmsCodRec
        ? `COD_REC informado: ${context.icmsCodRec}.`
        : "E116 (quando há ICMS a recolher) exige COD_REC — código da receita estadual (ex.: tabela SEFAZ-SP).",
      explanation:
        "O E116 lista o recolhimento de ICMS. O campo COD_REC é o código da receita do Estado (diferente por UF e dependente de tabela oficial da SEFAZ). Este gerador NÃO inventa esse código — se ficar em branco, o PVA pode rejeitar ou exigir ajuste.",
      fix: "Preencha 'COD_REC (E116)' no formulário com o código estadual correto para a apuração (consulte a SEFAZ da UF). Deixe em branco apenas se não houver ICMS a recolher no período.",
    },
    {
      id: "bloco_hkg",
      label: "Blocos B/G/H/K",
      status: "complete" as ReadinessStatus,
      message: "Gerados vazios (IND_MOV=1) conforme Guia — inventário/CIAP/controle fora do rascunho.",
      explanation:
        "Blocos B (carga/transporte), G (CIAP/ativo), H (inventário) e K (produção/estoque) são opcionais. Neste rascunho saem vazios (IND_MOV=1) porque inventário/CIAP/controle não estão no escopo. Isso é válido para a maioria dos contribuintes.",
      fix: "Nada a fazer para um rascunho. Se a empresa for obrigada a informar inventário (H), CIAP (G) ou controle de produção (K), esses blocos terão de ser preenchidos em etapa posterior — fora deste gerador.",
    },
    {
      id: "tipo_item_0200",
      label: "0200: TIPO_ITEM do item",
      status: "review" as ReadinessStatus,
      explanation:
        "Cada item (0200) recebe TIPO_ITEM=00 (sem informação de tipo). O Guia exige que o contador confirme o tipo correto (00, 01, 02…) antes do uso em produção — o XML/NF-e não traz esse dado de forma unívoca.",
      fix: "Confirme com o contador o TIPO_ITEM adequado para seus produtos. Para um rascunho de pré-validação o 00 é aceito pelo PVA, mas revise antes do envio oficial.",
    },
    {
      id: "ind_frt_c100",
      label: "C100: IND_FRT (frete)",
      status: "review" as ReadinessStatus,
      explanation:
        "Quando o frete não vem informado na NF-e, o C100 recebe IND_FRT=9 (outros). Isso pode não refletir a operação real e afeta a apuração de ICMS sobre frete.",
      fix: "Garanta que o frete/transporte esteja no XML importado. Se por conta do emitente (CIF), ajuste IND_FRT para 0; se por conta do destinatário (FOB), para 1. Revise caso a caso.",
    },
    {
      id: "bloco1_1010",
      label: "Bloco 1 (1010): obrigações acessórias",
      status: "review" as ReadinessStatus,
      explanation:
        "O Bloco 1 (1001/1010) é gerado com TODAS as respostas 'N' (sem exportação, combustível, cartão, etc.). Se a empresa se enquadrar em alguma obrigação acessória, o PVA/Receita podem exigir 'S'.",
      fix: "Revise o Bloco 1: se houver exportação (IND_EXP), combustível (IND_COMB), operadora de cartão (IND_CART), ativo imobilizado ou outro, marque 'S' no campo correspondente. Para a maioria dos contribuintes, 'N' está correto.",
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

    const codMod = d.model || "55";
    // SPED/Guia 3.2.2 + PVA v6.1.0 (MSG_NFE_EMITIDA_15001_V1):
    // NF-e de emissão própria (IND_EMIT=0) → C100 + C190 (consolidado). C170 é
    // proibido sem os filhos C176/C177/C180/C181. NF-e de terceiros (IND_EMIT=1)
    // ou NF modelo 01 → C100 + C170 (detalhe por item), sem C190.
    const isOwnIssueNfe = codMod === "55" && indEmit === "0";

    const c190Map = new Map<
      string,
      { cst: string; cfop: string; aliq: string; vlOpr: string; vlBc: string; vlIcms: string; vlIpi: string }
    >();

    for (const item of d.items) {
      const cst = cstIcms(item);
      const cfop = onlyDigits(item.cfop || "").slice(0, 4);
      const aliq = moneyToFixed(item.tax.icms.pIcms);

      if (isOwnIssueNfe) {
        // Emissão própria NF-e: consolidar itens em C190 (por CST/CFOP/ALIQ).
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
        continue;
      }

      // Terceiros NF-e (IND_EMIT=1) ou NF modelo 01: C170 por item.
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
          moneyToEfd(item.tax.ipi.vBc), // 22 VL_BC_IPI
          moneyToEfd(item.tax.ipi.pIpi), // 23 ALIQ_IPI
          moneyToEfd(item.tax.ipi.vIpi), // 24 VL_IPI
          item.tax.pis.cst || "", // 25 CST_PIS
          moneyToEfd(item.tax.pis.vBc), // 26 VL_BC_PIS
          moneyToEfd(item.tax.pis.pAliq, 4), // 27 ALIQ_PIS
          "", // 28 QUANT_BC_PIS
          "", // 29 ALIQ_PIS_QUANT (alíquota em reais; vazia p/ CST percentual)
          moneyToEfd(item.tax.pis.vValor), // 30 VL_PIS
          item.tax.cofins.cst || "", // 31 CST_COFINS
          moneyToEfd(item.tax.cofins.vBc), // 32 VL_BC_COFINS
          moneyToEfd(item.tax.cofins.pAliq, 4), // 33 ALIQ_COFINS
          "", // 34 QUANT_BC_COFINS
          "", // 35 ALIQ_COFINS_QUANT (alíquota em reais; vazia p/ CST percentual)
          moneyToEfd(item.tax.cofins.vValor), // 36 VL_COFINS
          "", // 37 COD_CTA
          "", // 38 VL_ABAT_NT
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

    if (isOwnIssueNfe) {
      for (const agg of c190Map.values()) {
        // C190 (leiaute 020): REG, CST_ICMS, CFOP, ALIQ_ICMS, VL_OPR, VL_BC_ICMS,
        // VL_ICMS, VL_BC_ICMS_ST, VL_ICMS_ST, VL_RED_BC, VL_IPI, COD_OBS
        // VL_RED_BC: p/ CST de redução de base (20/70) = VL_OPR − VL_BC_ICMS (>0 obrigatório).
        const cstSuffix = agg.cst.slice(-2);
        const isRedBase = cstSuffix === "20" || cstSuffix === "70";
        const vlRedBc = isRedBase
          ? moneyToEfd(new Money(money(agg.vlOpr).scaled - money(agg.vlBc).scaled))
          : "0";
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
            vlRedBc, // VL_RED_BC
            moneyToEfd(agg.vlIpi), // VL_IPI
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
    "NF-e emissão própria (IND_EMIT=0) usa C100 + C190; NF-e terceiros/modelo 01 usam C100 + C170.",
    "IND_FRT=9 quando frete não informado — revise.",
    "0200/0400/0190 gerados somente quando há C170 (NF-e terceiros ou NF modelo 01).",
    "Blocos B/G/H/K gerados vazios (IND_MOV=1) — inventário/CIAP/controle não preenchidos.",
    "Arquivo destinado à pré-validação interna e importação no PVA oficial.",
  ];
  if (!onlyDigits(context.codMun) || onlyDigits(context.codMun).length !== 7) {
    warnings.push("COD_MUN ausente/inválido no 0000 — obrigatório no Guia (7 dígitos IBGE).");
  }
  if ((context.excludedDocumentCount ?? 0) > 0) {
    warnings.push(
      `${context.excludedDocumentCount} NF-e excluída(s) por status (cancelada/denegada/inutilizada/rejeitada) — não entram no SPED.`,
    );
  }
  if (!onlyDigits(context.cep) || !context.address || !context.neighborhood) {
    warnings.push("0005 incompleto (CEP/END/BAIRRO obrigatórios) — complete o cadastro do estabelecimento.");
  }

  // Ordem Bloco 0: 0000 → 0001 → 0002? → 0005 → 0100? → 0150 → 0190 → 0200 → 0400 → 0990
  const bloco0: ObligationRecord[] = [build0000(context), { type: "0001", fields: ["0001", "0"] }];
  if (context.activityCode === "0") {
    // 0002 — Classificação do estabelecimento industrial (Tabela 4.5.5).
    // Guia Prático: obrigatório SOMENTE quando IND_ATIV (0000) = "0" (industrial).
    // Leiaute 020 (NT 2025.001): REG + CLAS_ESTAB_IND (2 dígitos).
    bloco0.push({
      type: "0002",
      fields: ["0002", onlyDigits(context.industrialClass || "00").slice(0, 2)],
    });
  }
  bloco0.push(build0005(context));

  if (context.accountantName && context.accountantCpf && context.accountantCrc && context.accountantEmail) {
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

  const cFamily = buildC100Family(context);
  const cFlat = flattenRecords(cFamily);
  const hasC170 = cFlat.some((r) => r.type === "C170");

  bloco0.push(...build0150(context));
  if (hasC170) {
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
  } else {
    warnings.push(
      "0190/0200/0400 omitidos — emissão própria de NF-e usa C190 (sem detalhe C170 por item).",
    );
  }
  bloco0.push({ type: "0990", fields: ["0990", String(bloco0.length + 1)] });
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
  // E500/E520 = totalização da apuração do IPI, derivada dos valores de VL_IPI dos
  // C170/C190. Só se apresenta se houver OPERAÇÃO de IPI no período. Empresa que não
  // é contribuinte do IPI (ex.: cooperativa) NÃO deve apresentar E500 (MSG_NAO_EXISTE_APURACAO_IPI).
  const hasIpi = context.documents.some((d) =>
    d.items.some((i) => money(i.tax.ipi.vIpi).scaled > 0),
  );
  if (hasIpi) {
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
  if (!hasIpi) {
    warnings.push(
      "E500/E520 de IPI omitidos — nenhuma operação com IPI no período (empresa não contribuinte do IPI ou sem IPI apurável).",
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
