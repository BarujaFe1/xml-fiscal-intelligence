import { describe, expect, it } from "vitest";
import {
  parseCompanyDirectoryPdfText,
  parseKeyValueCompanyPdfText,
  parseSiegClientsPdfText,
} from "@/modules/company-directory";

/** Synthetic SIEG Hub «Clientes» print — no real taxpayer IDs. */
const SIEG_FIXTURE = `
Clientes Vencimento
ACME FISCAL DEMO LTDA
11222333000181
No Prazo Sucesso Não - 27/04/2027
MARIA DEMO SILVA
12345678909
No Prazo Alerta Não - 06/04/2027
ACME FISCAL DEMO
E FILIAL
11222333000262
No Prazo Sucesso Sim Sucesso 06/04/2027
BETA COMERCIO
EXEMPLO SA
44555666000177
Vencido Vencido Não - 20/06/2026
Cert.
Cadastrado
Status do
Certificado
13/07/2026, 16:50 SIEG - Home
https://hub.sieg.com 1/1
`.trim();

describe("parseSiegClientsPdfText", () => {
  it("extrai CNPJ/CPF e nomes multilinha do layout SIEG", () => {
    const r = parseSiegClientsPdfText(SIEG_FIXTURE);
    expect(r.source).toBe("sieg-clients");
    expect(r.entries).toHaveLength(4);
    expect(r.entries[0]).toEqual({
      name: "ACME FISCAL DEMO LTDA",
      document: "11222333000181",
      kind: "cnpj",
    });
    expect(r.entries[1]).toEqual({
      name: "MARIA DEMO SILVA",
      document: "12345678909",
      kind: "cpf",
    });
    expect(r.entries[2]).toEqual({
      name: "ACME FISCAL DEMO E FILIAL",
      document: "11222333000262",
      kind: "cnpj",
    });
    expect(r.entries[3].document).toBe("44555666000177");
    expect(r.entries[3].kind).toBe("cnpj");
  });

  it("deduplica o mesmo documento", () => {
    const dup = `${SIEG_FIXTURE}\nACME AGAIN\n11222333000181\nNo Prazo`;
    const r = parseSiegClientsPdfText(dup);
    expect(r.entries.filter((e) => e.document === "11222333000181")).toHaveLength(1);
  });
});

describe("parseKeyValueCompanyPdfText", () => {
  it("lê cadastro simples chave:valor", () => {
    const { entry } = parseKeyValueCompanyPdfText(`
Razão social: ACME FISCAL DEMO LTDA
CNPJ: 11.222.333/0001-81
IE: 123456789
UF: SP
CEP: 01310-100
Endereço: Av Paulista
Número: 1000
Bairro: Bela Vista
Código município: 3550308
`);
    expect(entry?.kind).toBe("cnpj");
    expect(entry?.document).toBe("11222333000181");
    expect(entry?.ie).toBe("123456789");
    expect(entry?.codMun).toBe("3550308");
    expect(entry?.address).toBe("Av Paulista");
  });
});

describe("parseCompanyDirectoryPdfText", () => {
  it("prefere lista SIEG quando há vários cadastros", () => {
    const r = parseCompanyDirectoryPdfText(SIEG_FIXTURE);
    expect(r.entries.length).toBeGreaterThan(1);
    expect(r.source).toBe("sieg-clients");
  });
});
