/**
 * Recuperação canônica de ECF anterior (TXT → modelo), preservando lineage de linha.
 * Não “cola” TXT no arquivo novo.
 */

import type { EcfPriorCanonical } from "@/modules/ecf/types";

function fieldsOf(line: string): string[] {
  return line.split("|").filter((_, idx, a) => idx > 0 && idx < a.length - 1);
}

export function parseEcfPriorTxt(txt: string): EcfPriorCanonical {
  const warnings: string[] = [];
  const accountHints: EcfPriorCanonical["accountHints"] = [];
  const l030Hints: EcfPriorCanonical["l030Hints"] = [];
  let layoutHint: string | undefined;
  let year: string | undefined;
  let cnpj: string | undefined;
  let regime: string | undefined;

  const lines = txt.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const lineageLine = idx + 1;
    if (!line.includes("|")) return;
    const fields = fieldsOf(line);
    const reg = fields[0];
    if (reg === "0000") {
      // |0000|LECF|layout|ind|nome|cnpj|ano|...|regime|...
      layoutHint = fields[2];
      cnpj = fields[5];
      year = fields[6];
      regime = fields[10] || fields[9];
      return;
    }
    // J050 / K155–ish account hints (códigos comuns em rascunhos)
    if (reg === "J050" || reg === "K155" || reg === "X390") {
      const code = fields[2] || fields[1] || "";
      const name = fields[3] || fields[4];
      const referentialCode = fields[4] || fields[5] || fields[6];
      if (code) {
        accountHints.push({
          code,
          name,
          referentialCode: referentialCode || undefined,
          lineageLine,
        });
      }
      return;
    }
    if (reg === "L030") {
      l030Hints.push({
        year: fields[1] || year || "",
        periodCode: fields[2] || "",
        fields,
        lineageLine,
      });
    }
  });

  if (!cnpj) warnings.push("ECF prior sem 0000/CNPJ reconhecível");
  if (!accountHints.length) {
    warnings.push("Nenhuma conta canônica (J050/K155/X390) encontrada — recuperar via ledger/ECD");
  }

  return { layoutHint, year, cnpj, regime, accountHints, l030Hints, warnings };
}

/** Vincula sugestões de mapa a partir do prior (sem confirmar). */
export function mapsFromPriorHints(
  prior: EcfPriorCanonical,
  meta: { workspaceId: string; companyId: string },
): Array<{
  accountCode: string;
  suggestedReferentialCode: string;
  suggestionSource: "history";
}> {
  const out: Array<{
    accountCode: string;
    suggestedReferentialCode: string;
    suggestionSource: "history";
  }> = [];
  for (const h of prior.accountHints) {
    if (h.referentialCode) {
      out.push({
        accountCode: h.code,
        suggestedReferentialCode: h.referentialCode,
        suggestionSource: "history",
      });
    }
  }
  void meta;
  return out;
}
