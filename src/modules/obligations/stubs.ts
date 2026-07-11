/** Stub plugins — no generation until fixtures + rules exist. */
export const efdContribuicoesStub = {
  id: "efd-contribuicoes",
  status: "stub" as const,
  reason: "Requires complementary revenue/expense data; 2027 transition rules separate from 2026.",
};

export const ecdStub = {
  id: "ecd",
  status: "stub" as const,
  reason: "Requires accounting ledger — cannot be built from fiscal XML alone.",
};

export const ecfStub = {
  id: "ecf",
  status: "stub" as const,
  reason: "Depends on ECD + tax regime + IRPJ/CSLL assessment.",
};

export const reinfStub = {
  id: "reinf",
  status: "stub" as const,
  reason: "Event-based; needs contractual/financial context beyond XML.",
};
