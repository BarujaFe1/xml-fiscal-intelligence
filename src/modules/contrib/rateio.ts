/**
 * Rateio auditável — pesos explícitos; sem rateio silencioso.
 */

import type { RateioLine } from "@/modules/contrib/types";

export type RateioIssue = { severity: "error" | "warning"; message: string };

export function validateRateio(lines: RateioLine[]): RateioIssue[] {
  const issues: RateioIssue[] = [];
  if (!lines.length) return issues;
  const byKey = new Map<string, RateioLine[]>();
  for (const l of lines) {
    const g = byKey.get(l.key) || [];
    g.push(l);
    byKey.set(l.key, g);
  }
  for (const [key, group] of byKey) {
    const sum = group.reduce((a, l) => a + l.weight, 0);
    if (Math.abs(sum - 1) > 1e-6) {
      issues.push({
        severity: "error",
        message: `Rateio "${key}" soma weights=${sum} (deve ser 1.0) — sem rateio silencioso`,
      });
    }
    for (const l of group) {
      if (l.weight < 0 || l.weight > 1) {
        issues.push({
          severity: "error",
          message: `Peso inválido em ${key}/${l.label}: ${l.weight}`,
        });
      }
    }
  }
  return issues;
}

export function applyRateio(
  amount: number,
  lines: RateioLine[],
  key: string,
): Array<{ label: string; amount: number; weight: number; targetCenter?: string }> {
  const group = lines.filter((l) => l.key === key);
  if (!group.length) {
    return [{ label: "sem_rateio", amount, weight: 1 }];
  }
  const issues = validateRateio(group);
  if (issues.some((i) => i.severity === "error")) {
    throw new Error(issues.map((i) => i.message).join("; "));
  }
  return group.map((l) => ({
    label: l.label,
    amount: amount * l.weight,
    weight: l.weight,
    targetCenter: l.targetCenter,
  }));
}
