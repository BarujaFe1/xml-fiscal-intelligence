import { describe, expect, it } from "vitest";
import {
  cadastroToEstablishmentFiscalInput,
  type LocalCompany,
} from "@/lib/store/local-cadastro";

function baseCompany(over: Partial<LocalCompany> = {}): LocalCompany {
  return {
    id: "cid-1",
    name: "EMPRESA DEMO LTDA",
    cnpj: "11222333000181",
    uf: "SP",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const PERIOD = {
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  layoutVersion: "EFD_ICMS_IPI_2026_DRAFT",
} as const;

describe("cadastroToEstablishmentFiscalInput (PR4)", () => {
  it("mapeia cadastro industrial real sem inventar", () => {
    const c = baseCompany({
      activityCode: "1",
      profile: "A",
      purpose: "0",
      industrialClass: "02",
      priorCreditBalance: "1500,00",
      cnae: "4623107",
      cnaeDescription: "Comércio atacadista",
    });
    const out = cadastroToEstablishmentFiscalInput(c, null, PERIOD);
    expect(out.activityCode).toBe("1");
    expect(out.profile).toBe("A");
    expect(out.purpose).toBe("0");
    expect(out.industrialClass).toBe("02");
    expect(out.priorCreditBalance).toBe("1500,00");
    expect(out.cnae).toBe("4623107");
    expect(out.cnpj).toBe("11222333000181");
    expect(out.periodStart).toBe("2026-06-01");
    expect(out.layoutVersion).toBe("EFD_ICMS_IPI_2026_DRAFT");
  });

  it("aplica defaults quando cadastro incompleto (não industrial)", () => {
    const c = baseCompany();
    const out = cadastroToEstablishmentFiscalInput(c, null, PERIOD);
    expect(out.activityCode).toBe("0");
    expect(out.profile).toBe("A");
    expect(out.purpose).toBe("0");
    expect(out.industrialClass).toBeUndefined();
    expect(out.priorCreditBalance).toBeUndefined();
  });

  it("estabelecimento sobrepõe UF/IE e define establishmentId", () => {
    const c = baseCompany({ uf: "SP", ie: "123" });
    const out = cadastroToEstablishmentFiscalInput(
      c,
      {
        id: "e1",
        companyId: "cid-1",
        name: "Filial",
        uf: "PR",
        ie: "999",
        codMun: "3550308",
        createdAt: "",
      },
      PERIOD,
    );
    expect(out.uf).toBe("PR");
    expect(out.ie).toBe("999");
    expect(out.establishmentId).toBe("e1");
  });
});
