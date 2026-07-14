/**
 * Gera registros ECF assistidos a partir de ledger + mapas (+ e-Lalur opcional).
 * IRPJ/CSLL só se motor gated estiver ligado.
 */

import type {
  ObligationBuildResult,
  ObligationContext,
  ObligationRecord,
} from "@/modules/obligations/core/types";
import { appendSpedClosers } from "@/modules/obligations/core/pipe";
import type { EcfWorkspaceSnapshot, IrpjCsllComputation } from "@/modules/ecf/types";
import { listOrphanAccounts } from "@/modules/ecf/mapper";
import { computeIrpjCsll } from "@/modules/ecf/irpj/engine";
import { sumPartA } from "@/modules/ecf/elalur/model";

export const ECF_LAYOUT_2026 = "ECF_2026_DRAFT";

function resolvedReferential(
  accountCode: string,
  snap: EcfWorkspaceSnapshot,
): string {
  const acc = snap.ledger.accounts.find((a) => a.code === accountCode);
  if (acc?.referentialCode?.trim()) return acc.referentialCode.trim();
  const map = snap.maps.find((m) => m.accountCode === accountCode && m.confirmedAt);
  return map?.referentialCode?.trim() || "";
}

export function buildEcfFromWorkspace(
  context: ObligationContext,
  snap: EcfWorkspaceSnapshot,
  opts?: { includeIrpj?: boolean },
): ObligationBuildResult {
  const warnings: string[] = [
    "ECF a partir de ledger/mapas — não calcular IRPJ de XML fiscal.",
  ];
  const year = context.periodStart.slice(0, 4);
  const regime = String(context.extras?.taxRegime || "1");
  const records: ObligationRecord[] = [];

  records.push({
    type: "0000",
    fields: [
      "LECF",
      ECF_LAYOUT_2026,
      "0",
      context.companyName.slice(0, 100),
      context.cnpj.replace(/\D/g, "").slice(0, 14),
      year,
      "0",
      context.purpose || "0",
      "0",
      regime,
      "0",
      "0",
      "N",
      "N",
    ],
  });
  records.push({ type: "0001", fields: ["0"] });
  records.push({
    type: "0010",
    fields: [regime, "N", "N", "N", "N", "N", "N", "N"],
  });
  records.push({
    type: "0020",
    fields: [context.periodStart.replace(/-/g, ""), context.periodEnd.replace(/-/g, ""), "0"],
  });
  records.push({ type: "0030", fields: [context.uf, "", "", "", "", ""] });
  records.push({ type: "0990", fields: ["6"] });

  records.push({ type: "C001", fields: ["1"] });
  records.push({ type: "C990", fields: ["2"] });

  records.push({ type: "E001", fields: ["1"] });
  records.push({ type: "E990", fields: ["2"] });

  // Plano / mapas → hints J050 (rascunho estrutural)
  const analytic = snap.ledger.accounts.filter((a) => a.kind === "analytic" && a.active);
  records.push({ type: "J001", fields: [analytic.length ? "0" : "1"] });
  for (const a of analytic) {
    const ref = resolvedReferential(a.code, snap);
    records.push({
      type: "J050",
      fields: [a.effectiveFrom.replace(/-/g, ""), a.code, a.name.slice(0, 100), ref || "SEM_MAPA"],
    });
    if (!ref) warnings.push(`Conta ${a.code} sem referencial confirmado`);
  }
  const jCount = records.filter((r) => r.type === "J001" || r.type === "J050").length + 1;
  records.push({ type: "J990", fields: [String(jCount)] });

  records.push({ type: "K001", fields: ["1"] });
  records.push({ type: "K990", fields: ["2"] });

  let tax: IrpjCsllComputation | undefined;
  if (opts?.includeIrpj) {
    tax = computeIrpjCsll(
      {
        periodKey: year,
        accountingProfit: String(context.extras?.accountingProfit || ""),
        elalur: snap.elalur,
      },
      {
        forceEnable: true,
        irpjRate:
          context.extras?.irpjRate != null ? Number(context.extras.irpjRate) : undefined,
        csllRate:
          context.extras?.csllRate != null ? Number(context.extras.csllRate) : undefined,
      },
    );
  } else {
    tax = computeIrpjCsll({ periodKey: year });
  }

  const part = snap.elalur ? sumPartA(snap.elalur.partA) : null;
  records.push({ type: "L001", fields: ["0"] });
  if (tax.enabled && tax.lines[0]) {
    const line = tax.lines[0];
    records.push({
      type: "L030",
      fields: [year, "A00", line.baseIrpj, line.irpj, line.baseCsll, line.csll],
    });
    warnings.push(...tax.warnings);
    warnings.push("L030 preenchido pelo motor gated — validar no Programa ECF");
  } else {
    records.push({
      type: "L030",
      fields: [
        year,
        "A00",
        part ? String(part.additions) : "0",
        "0",
        "0",
        "0",
      ],
    });
    warnings.push(tax.gatedReason || "L030 sem IRPJ calculado (flag off)");
  }

  if (snap.elalur?.partA.length) {
    for (const line of snap.elalur.partA) {
      records.push({
        type: "M300",
        fields: [
          line.kind === "addition" ? "1" : line.kind === "exclusion" ? "2" : "3",
          line.accountCode,
          line.amount,
          line.legalDevice || "",
          line.history || "",
        ],
      });
    }
  }
  const lCount = records.filter((r) => r.type.startsWith("L") || r.type.startsWith("M")).length;
  records.push({ type: "L990", fields: [String(lCount + 1)] });

  records.push({ type: "X001", fields: ["1"] });
  records.push({ type: "X990", fields: ["2"] });
  records.push({ type: "Y001", fields: ["1"] });
  records.push({ type: "Y990", fields: ["2"] });

  const orphans = listOrphanAccounts(snap.ledger.accounts, snap.maps);
  if (orphans.length) {
    warnings.push(`${orphans.length} conta(s) analítica(s) órfãs no mapper`);
  }

  const closed = appendSpedClosers(records, warnings);
  return {
    obligationId: "ecf",
    layoutVersion: ECF_LAYOUT_2026,
    records: closed,
    lineage: analytic.slice(0, 50).map((a) => ({
      record: "J050",
      field: "COD_CTA",
      value: a.code,
      sourceType: "cadastro" as const,
      sourceRef: a.id,
    })),
    warnings,
  };
}
