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

/**
 * Authorization protocol lives under infProt (inside protNFe/protCTe).
 * Never treat the wrapper protNFe as the leaf — nProt is nested.
 */
export interface AuthorizationProtocol {
  protocol?: string;
  authorizationDate?: string;
  cStat?: string;
  xMotivo?: string;
  accessKeyFromProt?: string;
}

export function extractAuthorizationProtocol(
  parsed: unknown,
  options?: { accessKeyFields?: string[] },
): AuthorizationProtocol {
  const infProt = findNode(parsed, ["infProt"]) as Record<string, unknown> | undefined;
  if (!infProt) return {};
  const accessKeyFields = options?.accessKeyFields || ["chNFe", "chCTe"];
  return {
    protocol: asString(deepGet(infProt, ["nProt"])),
    authorizationDate: asString(deepGet(infProt, ["dhRecbto"])),
    cStat: asString(deepGet(infProt, ["cStat"])),
    xMotivo: asString(deepGet(infProt, ["xMotivo"])),
    accessKeyFromProt: asString(deepGet(infProt, accessKeyFields)),
  };
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
  emitterIe?: string;
  emitterCity?: string;
  emitterCityCode?: string;
  emitterUf?: string;
  emitterAddress?: string;
  emitterAddressNumber?: string;
  emitterAddressCompl?: string;
  emitterNeighborhood?: string;
  emitterCep?: string;
  receiverDoc?: string;
  receiverName?: string;
  receiverIe?: string;
  receiverCity?: string;
  receiverCityCode?: string;
  receiverUf?: string;
  receiverAddress?: string;
  receiverAddressNumber?: string;
  receiverAddressCompl?: string;
  receiverNeighborhood?: string;
  receiverCep?: string;
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

function partyAddress(ender: Record<string, unknown> | undefined) {
  if (!ender) return {};
  return {
    city: asString(deepGet(ender, ["xMun"])),
    cityCode: asString(deepGet(ender, ["cMun"])),
    uf: asString(deepGet(ender, ["UF"])),
    address: asString(deepGet(ender, ["xLgr"])),
    addressNumber: asString(deepGet(ender, ["nro"])),
    addressCompl: asString(deepGet(ender, ["xCpl"])),
    neighborhood: asString(deepGet(ender, ["xBairro"])),
    cep: asString(deepGet(ender, ["CEP", "cep"])),
  };
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
  const auth = extractAuthorizationProtocol(parsed, { accessKeyFields: ["chNFe"] });
  const enderEmit = findNode(emit, ["enderEmit"]) as Record<string, unknown> | undefined;
  const enderDest = findNode(dest, ["enderDest"]) as Record<string, unknown> | undefined;
  const emitAddr = partyAddress(enderEmit);
  const destAddr = partyAddress(enderDest);

  const idAttr =
    asString(deepGet(infNFe, ["@_Id", "Id"])) ||
    asString(deepGet(findNode(parsed, ["infNFe"]), ["@_Id"]));
  const accessKey =
    auth.accessKeyFromProt || (idAttr ? idAttr.replace(/^NFe/i, "") : undefined);

  return {
    accessKey,
    number: asString(deepGet(ide, ["nNF"])),
    series: asString(deepGet(ide, ["serie"])),
    model: asString(deepGet(ide, ["mod"])),
    issueDate: asString(deepGet(ide, ["dhEmi", "dEmi"])),
    authorizationDate: auth.authorizationDate,
    emitterDoc: getDoc(emit),
    emitterName: getName(emit),
    emitterIe: asString(deepGet(emit, ["IE", "ie"])),
    emitterCity: emitAddr.city,
    emitterCityCode: emitAddr.cityCode,
    emitterUf: emitAddr.uf,
    emitterAddress: emitAddr.address,
    emitterAddressNumber: emitAddr.addressNumber,
    emitterAddressCompl: emitAddr.addressCompl,
    emitterNeighborhood: emitAddr.neighborhood,
    emitterCep: emitAddr.cep,
    receiverDoc: getDoc(dest),
    receiverName: getName(dest),
    receiverIe: asString(deepGet(dest, ["IE", "ie"])),
    receiverCity: destAddr.city,
    receiverCityCode: destAddr.cityCode,
    receiverUf: destAddr.uf,
    receiverAddress: destAddr.address,
    receiverAddressNumber: destAddr.addressNumber,
    receiverAddressCompl: destAddr.addressCompl,
    receiverNeighborhood: destAddr.neighborhood,
    receiverCep: destAddr.cep,
    totalValue: parseNumber(deepGet(icmsTot, ["vNF"])),
    productsValue: parseNumber(deepGet(icmsTot, ["vProd"])),
    freightValue: parseNumber(deepGet(icmsTot, ["vFrete"])),
    discountValue: parseNumber(deepGet(icmsTot, ["vDesc"])),
    taxValue:
      (parseNumber(deepGet(icmsTot, ["vICMS"])) || 0) +
      (parseNumber(deepGet(icmsTot, ["vIPI"])) || 0) +
      (parseNumber(deepGet(icmsTot, ["vPIS"])) || 0) +
      (parseNumber(deepGet(icmsTot, ["vCOFINS"])) || 0) || undefined,
    status: auth.cStat || auth.xMotivo,
    protocol: auth.protocol,
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
  const auth = extractAuthorizationProtocol(parsed, { accessKeyFields: ["chCTe"] });
  const enderEmit = findNode(emit, ["enderEmit"]) as Record<string, unknown> | undefined;

  const idAttr = asString(deepGet(infCte, ["@_Id", "Id"]));
  const accessKey =
    auth.accessKeyFromProt || (idAttr ? idAttr.replace(/^CTe/i, "") : undefined);

  const toma = findNode(parsed, ["toma3", "toma4", "toma"]) as Record<string, unknown> | undefined;
  const tomadorDoc = getDoc(toma) || getDoc(dest) || getDoc(rem);

  return {
    accessKey,
    number: asString(deepGet(ide, ["nCT"])),
    series: asString(deepGet(ide, ["serie"])),
    model: asString(deepGet(ide, ["mod"])) || "57",
    issueDate: asString(deepGet(ide, ["dhEmi", "dEmi"])),
    authorizationDate: auth.authorizationDate,
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
    status: auth.cStat || auth.xMotivo,
    protocol: auth.protocol,
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
