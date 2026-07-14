import { sha256Hex } from "@/lib/security/hash";
import { REINF_CATALOG } from "@/modules/obligations/reinf/catalog";

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Minimal canonical XML drafts for implemented events.
 * Not claiming full XSD compliance — marker xmlns draft until official schemas wired.
 */
export function buildR1000Xml(input: {
  cnpj: string;
  periodKey: string;
  tpAmb?: 1 | 2;
  contactName?: string;
  contactCpf?: string;
}): string {
  const nr = input.cnpj.replace(/\D/g, "").slice(0, 14);
  const tpAmb = input.tpAmb ?? 2;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtInfoContri/draft">` +
    `<evtInfoContri id="ID${nr}${input.periodKey.replace("-", "")}">` +
    `<ideEvento>` +
    `<tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi>` +
    `<verProc>${esc(REINF_CATALOG.version)}</verProc>` +
    `<perApur>${esc(input.periodKey)}</perApur>` +
    `</ideEvento>` +
    `<ideContri><tpInsc>1</tpInsc><nrInsc>${esc(nr)}</nrInsc></ideContri>` +
    `<infoContri><inclusao><idePeriodo><iniValid>${esc(input.periodKey)}</iniValid></idePeriodo>` +
    `<infoCadastro><classTrib>00</classTrib>` +
    `<contato><nmCtt>${esc(input.contactName || "PENDENTE")}</nmCtt>` +
    `<cpfCtt>${esc((input.contactCpf || "").replace(/\D/g, "").slice(0, 11) || "00000000000")}</cpfCtt>` +
    `</contato></infoCadastro></inclusao></infoContri>` +
    `</evtInfoContri></Reinf>`
  );
}

export function buildR2010CandidateXml(input: {
  cnpj: string;
  periodKey: string;
  tomadorDoc?: string;
  vlServico?: string;
  accessKey?: string;
  tpAmb?: 1 | 2;
}): string {
  const nr = input.cnpj.replace(/\D/g, "").slice(0, 14);
  const tpAmb = input.tpAmb ?? 2;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtTomadorServicos/draft">` +
    `<evtTomadorServicos id="ID${nr}2010">` +
    `<ideEvento><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi>` +
    `<verProc>${esc(REINF_CATALOG.version)}</verProc>` +
    `<perApur>${esc(input.periodKey)}</perApur></ideEvento>` +
    `<ideContri><tpInsc>1</tpInsc><nrInsc>${esc(nr)}</nrInsc></ideContri>` +
    `<infoServTom>` +
    `<ideEstabObra><tpInscEstab>1</tpInscEstab><nrInscEstab>${esc(nr)}</nrInscEstab>` +
    `<idePrestServ><cnpjPrestador>${esc((input.tomadorDoc || "").replace(/\D/g, "").slice(0, 14))}</cnpjPrestador>` +
    `<vlrTotalBruto>${esc(input.vlServico || "0,00")}</vlrTotalBruto>` +
    `<nota><chave>${esc(input.accessKey || "")}</chave>` +
    `<status>pending_confirmation</status></nota>` +
    `</idePrestServ></ideEstabObra></infoServTom>` +
    `</evtTomadorServicos></Reinf>`
  );
}

export function buildR2099Xml(input: {
  cnpj: string;
  periodKey: string;
  tpAmb?: 1 | 2;
}): string {
  const nr = input.cnpj.replace(/\D/g, "").slice(0, 14);
  const tpAmb = input.tpAmb ?? 2;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Reinf xmlns="http://www.reinf.esocial.gov.br/schemas/evtFechaEvPer/draft">` +
    `<evtFechaEvPer id="ID${nr}2099">` +
    `<ideEvento><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi>` +
    `<verProc>${esc(REINF_CATALOG.version)}</verProc>` +
    `<perApur>${esc(input.periodKey)}</perApur></ideEvento>` +
    `<ideContri><tpInsc>1</tpInsc><nrInsc>${esc(nr)}</nrInsc></ideContri>` +
    `<ideRespInf><nmResp>PENDENTE</nmResp><cpfResp>00000000000</cpfResp></ideRespInf>` +
    `<infoFech><evtServTm>S</evtServTm><evtServPr>N</evtServPr>` +
    `<evtAssDespRec>N</evtAssDespRec><evtAssDespRep>N</evtAssDespRep>` +
    `<evtComProd>N</evtComProd><evtCPRB>N</evtCPRB><evtAquis>N</evtAquis></infoFech>` +
    `</evtFechaEvPer></Reinf>`
  );
}

export async function hashXml(xml: string): Promise<string> {
  return sha256Hex(xml);
}
