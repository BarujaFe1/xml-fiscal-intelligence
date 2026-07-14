import { describe, expect, it } from "vitest";
import {
  localCompanyToFiscalPatch,
  mergeCompanyFields,
  type LocalCompany,
} from "@/lib/store/local-cadastro";
import { parseSiegClientsPdfText } from "@/modules/company-directory";

const base: LocalCompany = {
  id: "1",
  name: "ACME",
  cnpj: "11222333000181",
  kind: "cnpj",
  createdAt: "2026-01-01T00:00:00.000Z",
  source: "sieg-pdf",
};

describe("mergeCompanyFields", () => {
  it("preenche campos vazios sem inventar e marca merged quando fontes diferem", () => {
    const merged = mergeCompanyFields(base, {
      ie: "123",
      address: "Rua A",
      source: "xml-lote",
    });
    expect(merged.ie).toBe("123");
    expect(merged.address).toBe("Rua A");
    expect(merged.name).toBe("ACME");
    expect(merged.source).toBe("merged");
  });

  it("ignora string vazia (não apaga dado existente)", () => {
    const withIe = { ...base, ie: "999" };
    const merged = mergeCompanyFields(withIe, { ie: "  " });
    expect(merged.ie).toBe("999");
  });
});

describe("localCompanyToFiscalPatch", () => {
  it("usa estabelecimento quando presente", () => {
    const patch = localCompanyToFiscalPatch(
      { ...base, ie: "1", uf: "SP" },
      {
        id: "e1",
        companyId: "1",
        name: "Matriz",
        ie: "2",
        uf: "PR",
        createdAt: base.createdAt,
      },
    );
    expect(patch.ie).toBe("2");
    expect(patch.uf).toBe("PR");
    expect(patch.cnpj).toBe("11222333000181");
    expect(patch.companyName).toBe("ACME");
  });
});

describe("SIEG PDF → cadastro bulk shape", () => {
  it("extrai CNPJs prontos para upsert", () => {
    const text = `
Clientes
ACME FISCAL DEMO LTDA
11222333000181
No Prazo Sucesso Não - 27/04/2027
BETA COMERCIO SA
44555666000177
Vencido
`;
    const r = parseSiegClientsPdfText(text);
    const payloads = r.entries
      .filter((e) => e.kind === "cnpj")
      .map((e) => ({ name: e.name, cnpj: e.document, source: "sieg-pdf" as const }));
    expect(payloads).toHaveLength(2);
    expect(payloads[0].cnpj).toBe("11222333000181");
  });
});
