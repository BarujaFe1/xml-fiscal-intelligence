import { asString, deepGet, ensureArray, parseNumber } from "@/lib/utils";

function findNode(obj: unknown, names: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findNode(item, names);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const clean = (key.includes(":") ? key.split(":").pop()! : key).toLowerCase();
    if (names.map((n) => n.toLowerCase()).includes(clean)) return value;
  }
  for (const value of Object.values(record)) {
    const found = findNode(value, names);
    if (found !== undefined) return found;
  }
  return undefined;
}

function getDoc(node: unknown, ...keys: string[]) {
  for (const key of keys) {
    const v = deepGet(node, [key]);
    const s = asString(v);
    if (s) return s;
  }
  // try nested CNPJ/CPF
  const cnpj = asString(deepGet(node, ["CNPJ", "cnpj"]));
  if (cnpj) return cnpj;
  const cpf = asString(deepGet(node, ["CPF", "cpf"]));
  if (cpf) return cpf;
  return undefined;
}

function getName(node: unknown) {
  return (
    asString(deepGet(node, ["xNome", "xFant", "RazaoSocial", "NomeFantasia", "nome"])) ||
    undefined
  );
}

export interface FriendlySummary {
  accessKey?: string;
  number?: string;
  series?: string;
  model?: string;
  issueDate?: string;
  authorizationDate?: string;
  emitterDoc?: string;
  emitterName?: string;
  emitterCity?: string;
  emitterUf?: string;
  receiverDoc?: string;
  receiverName?: string;
  receiverCity?: string;
  receiverUf?: string;
  serviceCity?: string;
  totalValue?: number;
  productsValue?: number;
  servicesValue?: number;
  freightValue?: number;
  discountValue?: number;
  taxValue?: number;
  status?: string;
  protocol?: string;
  nature?: string;
  cfop?: string;
}

export function extractNFeSummary(parsed: unknown): FriendlySummary {
  const infNFe = findNode(parsed, ["infNFe"]) as Record<string, unknown> | undefined;
  const ide = findNode(parsed, ["ide"]) as Record<string, unknown> | undefined;
  const emit = findNode(parsed, ["emit"]) as Record<string, unknown> | undefined;
  const dest = findNode(parsed, ["dest"]) as Record<string, unknown> | undefined;
  const total = findNode(parsed, ["ICMSTot", "total"]) as Record<string, unknown> | undefined;
  const icmsTot =
    (findNode(parsed, ["ICMSTot"]) as Record<string, unknown> | undefined) ||
    (total && (findNode(total, ["ICMSTot"]) as Record<string, unknown> | undefined));
  const prot = findNode(parsed, ["infProt", "protNFe"]) as Record<string, unknown> | undefined;
  const enderEmit = findNode(emit, ["enderEmit"]) as Record<string, unknown> | undefined;
  const enderDest = findNode(dest, ["enderDest"]) as Record<string, unknown> | undefined;

  const idAttr =
    asString(deepGet(infNFe, ["@_Id", "Id"])) ||
    asString(deepGet(findNode(parsed, ["infNFe"]), ["@_Id"]));
  const accessKey =
    asString(deepGet(prot, ["chNFe"])) ||
    (idAttr ? idAttr.replace(/^NFe/i, "") : undefined);

  return {
    accessKey,
    number: asString(deepGet(ide, ["nNF"])),
    series: asString(deepGet(ide, ["serie"])),
    model: asString(deepGet(ide, ["mod"])),
    issueDate: asString(deepGet(ide, ["dhEmi", "dEmi"])),
    authorizationDate: asString(deepGet(prot, ["dhRecbto"])),
    emitterDoc: getDoc(emit),
    emitterName: getName(emit),
    emitterCity: asString(deepGet(enderEmit, ["xMun"])),
    emitterUf: asString(deepGet(enderEmit, ["UF"])),
    receiverDoc: getDoc(dest),
    receiverName: getName(dest),
    receiverCity: asString(deepGet(enderDest, ["xMun"])),
    receiverUf: asString(deepGet(enderDest, ["UF"])),
    totalValue: parseNumber(deepGet(icmsTot, ["vNF"])),
    productsValue: parseNumber(deepGet(icmsTot, ["vProd"])),
    freightValue: parseNumber(deepGet(icmsTot, ["vFrete"])),
    discountValue: parseNumber(deepGet(icmsTot, ["vDesc"])),
    taxValue:
      (parseNumber(deepGet(icmsTot, ["vICMS"])) || 0) +
      (parseNumber(deepGet(icmsTot, ["vIPI"])) || 0) +
      (parseNumber(deepGet(icmsTot, ["vPIS"])) || 0) +
      (parseNumber(deepGet(icmsTot, ["vCOFINS"])) || 0) || undefined,
    status: asString(deepGet(prot, ["cStat", "xMotivo"])),
    protocol: asString(deepGet(prot, ["nProt"])),
    nature: asString(deepGet(ide, ["natOp"])),
  };
}

export function extractCTeSummary(parsed: unknown): FriendlySummary {
  const infCte = findNode(parsed, ["infCte"]) as Record<string, unknown> | undefined;
  const ide = findNode(parsed, ["ide"]) as Record<string, unknown> | undefined;
  const emit = findNode(parsed, ["emit"]) as Record<string, unknown> | undefined;
  const rem = findNode(parsed, ["rem"]) as Record<string, unknown> | undefined;
  const dest = findNode(parsed, ["dest"]) as Record<string, unknown> | undefined;
  const vPrest = findNode(parsed, ["vPrest"]) as Record<string, unknown> | undefined;
  const infCarga = findNode(parsed, ["infCarga"]) as Record<string, unknown> | undefined;
  const prot = findNode(parsed, ["infProt", "protCTe"]) as Record<string, unknown> | undefined;
  const enderEmit = findNode(emit, ["enderEmit"]) as Record<string, unknown> | undefined;

  const idAttr = asString(deepGet(infCte, ["@_Id", "Id"]));
  const accessKey =
    asString(deepGet(prot, ["chCTe"])) ||
    (idAttr ? idAttr.replace(/^CTe/i, "") : undefined);

  const toma = findNode(parsed, ["toma3", "toma4", "toma"]) as Record<string, unknown> | undefined;
  const tomadorDoc = getDoc(toma) || getDoc(dest) || getDoc(rem);

  return {
    accessKey,
    number: asString(deepGet(ide, ["nCT"])),
    series: asString(deepGet(ide, ["serie"])),
    model: asString(deepGet(ide, ["mod"])) || "57",
    issueDate: asString(deepGet(ide, ["dhEmi", "dEmi"])),
    authorizationDate: asString(deepGet(prot, ["dhRecbto"])),
    emitterDoc: getDoc(emit),
    emitterName: getName(emit),
    emitterCity: asString(deepGet(enderEmit, ["xMun"])) || asString(deepGet(ide, ["xMunIni"])),
    emitterUf: asString(deepGet(enderEmit, ["UF"])) || asString(deepGet(ide, ["UFIni"])),
    receiverDoc: tomadorDoc || getDoc(dest),
    receiverName: getName(dest) || getName(rem),
    receiverCity: asString(deepGet(ide, ["xMunFim"])),
    receiverUf: asString(deepGet(ide, ["UFFim"])),
    totalValue: parseNumber(deepGet(vPrest, ["vTPrest"])),
    productsValue: parseNumber(deepGet(infCarga, ["vCarga"])),
    freightValue: parseNumber(deepGet(vPrest, ["vRec"])),
    status: asString(deepGet(prot, ["cStat", "xMotivo"])),
    protocol: asString(deepGet(prot, ["nProt"])),
    nature: asString(deepGet(ide, ["natOp"])),
    cfop: asString(deepGet(ide, ["CFOP"])),
  };
}

export function extractNFSeSummary(parsed: unknown): FriendlySummary {
  const inf = (findNode(parsed, ["InfNfse", "infNfse", "InfDeclaracaoPrestacaoServico"]) ||
    parsed) as Record<string, unknown>;
  const servico = findNode(parsed, ["Servico", "servico"]) as Record<string, unknown> | undefined;
  const valores =
    (findNode(parsed, ["ValoresNfse", "Valores", "valores"]) as Record<string, unknown> | undefined) ||
    (findNode(servico, ["Valores"]) as Record<string, unknown> | undefined);
  const prestador = findNode(parsed, [
    "PrestadorServico",
    "Prestador",
    "prestador",
  ]) as Record<string, unknown> | undefined;
  const tomador = findNode(parsed, [
    "TomadorServico",
    "Tomador",
    "tomador",
  ]) as Record<string, unknown> | undefined;
  const ident = findNode(prestador, ["IdentificacaoPrestador", "CpfCnpj"]) as
    | Record<string, unknown>
    | undefined;
  const identTom = findNode(tomador, ["IdentificacaoTomador", "CpfCnpj"]) as
    | Record<string, unknown>
    | undefined;

  return {
    accessKey:
      asString(deepGet(inf, ["CodigoVerificacao", "codigoVerificacao"])) ||
      asString(deepGet(inf, ["Numero", "numero"])),
    number: asString(deepGet(inf, ["Numero", "numero", "NumeroNfse"])),
    series: asString(deepGet(inf, ["Serie", "serie"])),
    issueDate: asString(deepGet(inf, ["DataEmissao", "dataEmissao", "Competencia"])),
    emitterDoc: getDoc(prestador) || getDoc(ident),
    emitterName: getName(prestador) || asString(deepGet(prestador, ["RazaoSocial"])),
    emitterCity: asString(
      deepGet(findNode(prestador, ["Endereco"]), ["Cidade", "xMun", "CodigoMunicipio"]),
    ),
    receiverDoc: getDoc(tomador) || getDoc(identTom),
    receiverName: getName(tomador) || asString(deepGet(tomador, ["RazaoSocial"])),
    receiverCity: asString(
      deepGet(findNode(tomador, ["Endereco"]), ["Cidade", "xMun", "CodigoMunicipio"]),
    ),
    serviceCity: asString(
      deepGet(servico, ["MunicipioIncidencia", "CodigoMunicipio", "MunicipioPrestacaoServico"]),
    ),
    totalValue:
      parseNumber(deepGet(valores, ["ValorServicos", "ValorLiquidoNfse", "ValorNfse"])) ||
      parseNumber(deepGet(servico, ["ValorServicos"])),
    servicesValue: parseNumber(deepGet(valores, ["ValorServicos"])),
    discountValue: parseNumber(deepGet(valores, ["DescontoIncondicionado", "DescontoCondicionado"])),
    taxValue: parseNumber(deepGet(valores, ["ValorIss", "IssRetido", "ValorIssRetido"])),
    status: asString(deepGet(inf, ["Status", "status"])) || "autorizada",
    nature: asString(deepGet(servico, ["Discriminacao", "ItemListaServico", "CodigoServico"])),
  };
}

export interface ExtractedItem {
  itemNumber: number;
  code?: string;
  description?: string;
  ncm?: string;
  cfop?: string;
  unit?: string;
  quantity?: number;
  unitValue?: number;
  totalValue?: number;
  discountValue?: number;
  taxJson: Record<string, unknown>;
  rawJson: Record<string, unknown>;
}

export function extractNFeItems(parsed: unknown): ExtractedItem[] {
  const dets = ensureArray(findNode(parsed, ["det"]) as unknown);
  // also search nested
  let list = dets;
  if (!list.length) {
    const inf = findNode(parsed, ["infNFe"]) as Record<string, unknown> | undefined;
    list = ensureArray(inf?.det as unknown);
  }

  return list.map((det, index) => {
    const node = (det || {}) as Record<string, unknown>;
    const prod = (findNode(node, ["prod"]) || {}) as Record<string, unknown>;
    const imposto = (findNode(node, ["imposto"]) || {}) as Record<string, unknown>;
    const nItem = parseNumber(deepGet(node, ["@_nItem", "nItem"])) || index + 1;
    return {
      itemNumber: nItem,
      code: asString(deepGet(prod, ["cProd"])),
      description: asString(deepGet(prod, ["xProd"])),
      ncm: asString(deepGet(prod, ["NCM"])),
      cfop: asString(deepGet(prod, ["CFOP"])),
      unit: asString(deepGet(prod, ["uCom", "uTrib"])),
      quantity: parseNumber(deepGet(prod, ["qCom", "qTrib"])),
      unitValue: parseNumber(deepGet(prod, ["vUnCom", "vUnTrib"])),
      totalValue: parseNumber(deepGet(prod, ["vProd"])),
      discountValue: parseNumber(deepGet(prod, ["vDesc"])),
      taxJson: imposto,
      rawJson: node,
    };
  });
}

export function extractCTeLinkedDocs(parsed: unknown): ExtractedItem[] {
  const infDoc = findNode(parsed, ["infDoc"]) as Record<string, unknown> | undefined;
  const docs = [
    ...ensureArray(findNode(infDoc, ["infNFe"]) as unknown),
    ...ensureArray(findNode(infDoc, ["infNF"]) as unknown),
    ...ensureArray(findNode(infDoc, ["infOutros"]) as unknown),
  ];

  if (!docs.length) {
    // fallback: cargo product as single detail
    const infCarga = findNode(parsed, ["infCarga"]) as Record<string, unknown> | undefined;
    if (infCarga) {
      return [
        {
          itemNumber: 1,
          code: asString(deepGet(infCarga, ["proPred"])),
          description: asString(deepGet(infCarga, ["xOutCat", "proPred"])) || "Carga",
          quantity: parseNumber(deepGet(findNode(infCarga, ["infQ"]), ["qCarga"])),
          unit: asString(deepGet(findNode(infCarga, ["infQ"]), ["tpMed"])),
          totalValue: parseNumber(deepGet(infCarga, ["vCarga"])),
          taxJson: {},
          rawJson: infCarga,
        },
      ];
    }
    return [];
  }

  return docs.map((doc, index) => {
    const node = (doc || {}) as Record<string, unknown>;
    return {
      itemNumber: index + 1,
      code: asString(deepGet(node, ["chave", "nDoc", "nRoma", "nPed"])),
      description:
        asString(deepGet(node, ["descOutros", "xEsp"])) ||
        (asString(deepGet(node, ["chave"])) ? `NF-e ${asString(deepGet(node, ["chave"]))}` : "Documento vinculado"),
      totalValue: parseNumber(deepGet(node, ["vDoc", "vNF", "vPrest"])),
      taxJson: {},
      rawJson: node,
    };
  });
}

export function extractNFSeServiceDetails(parsed: unknown): ExtractedItem[] {
  const servico = findNode(parsed, ["Servico", "servico"]) as Record<string, unknown> | undefined;
  if (!servico) return [];
  const valores = (findNode(servico, ["Valores"]) || findNode(parsed, ["ValoresNfse"]) || {}) as Record<
    string,
    unknown
  >;
  return [
    {
      itemNumber: 1,
      code:
        asString(deepGet(servico, ["ItemListaServico", "CodigoServico", "CodigoTributacaoMunicipio"])) ||
        undefined,
      description: asString(deepGet(servico, ["Discriminacao", "discriminacao"])) || "Serviço",
      cfop: asString(deepGet(servico, ["CodigoCnae", "Cnae"])),
      totalValue: parseNumber(deepGet(valores, ["ValorServicos", "ValorLiquidoNfse"])),
      discountValue: parseNumber(deepGet(valores, ["DescontoIncondicionado"])),
      taxJson: valores,
      rawJson: servico,
    },
  ];
}
