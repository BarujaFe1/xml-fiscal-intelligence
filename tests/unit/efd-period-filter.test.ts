import { describe, expect, it } from "vitest";
import { filterDocumentsByPeriod } from "@/modules/obligations/efd-icms-ipi/from-batch";
import type { DocumentSummary } from "@/types";

/**
 * O recorte por período permite gerar EFDs de uma semana, dia, mês, semestre
 * ou intervalo arbitrário a partir de um único lote importado (ex.: ZIP mensal),
 * descartando NF-e cuja data de emissão está fora do recorte.
 */
function doc(id: string, issueDate?: string): DocumentSummary {
  return {
    id,
    workspaceId: "ws",
    batchId: "b",
    documentType: "NFE",
    fileName: `${id}.xml`,
    issueDate,
    emitterDoc: "11222333000181",
  } as DocumentSummary;
}

describe("filterDocumentsByPeriod", () => {
  const docs = [
    doc("jan", "2026-01-15"),
    doc("fev", "2026-02-10"),
    doc("mar", "2026-03-20"),
    doc("sem-data"),
  ];

  it("mantém só as NF-e dentro do recorte mensal", () => {
    const r = filterDocumentsByPeriod(docs, "2026-03-01", "2026-03-31");
    expect(r.inPeriod.map((d) => d.id).sort()).toEqual(["mar", "sem-data"]);
    expect(r.outOfPeriodCount).toBe(2);
  });

  it("recorta por semana (segunda a domingo)", () => {
    const r = filterDocumentsByPeriod(docs, "2026-01-12", "2026-01-18");
    expect(r.inPeriod.map((d) => d.id).sort()).toEqual(["jan", "sem-data"]);
    expect(r.outOfPeriodCount).toBe(2);
  });

  it("recorta por semestre", () => {
    const r = filterDocumentsByPeriod(docs, "2026-01-01", "2026-06-30");
    expect(r.inPeriod.map((d) => d.id).sort()).toEqual(["fev", "jan", "mar", "sem-data"]);
    expect(r.outOfPeriodCount).toBe(0);
  });

  it("sem período definido retorna tudo", () => {
    const r = filterDocumentsByPeriod(docs, "", "2026-03-31");
    expect(r.inPeriod.length).toBe(docs.length);
    expect(r.outOfPeriodCount).toBe(0);
  });
});
