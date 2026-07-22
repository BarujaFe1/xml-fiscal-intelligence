// scripts/seed-demo.mjs
//
// Deterministic synthetic seed-data generator for populated UI states.
// Pure Node (no browser, no external deps). Same output every run.
//
// Output (under private-test-data/seed/, which is gitignored):
//   companies.json      - companies with valid-format CNPJs
//   batches.json        - batches each containing documents
//   reconciliation.json - one open divergence + one resolved
//   closing.json        - pending items + one approved
//   efd-generation.json - an EFD generation in pva_rejected status
//   billing.json        - a billing record (and an explicit "absent" marker)
//   manifest.json       - describes each fixture
//
// Run: npm run seed:demo

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED = 0x5eed_d3ad; // fixed seed -> deterministic output
const OUT_DIR = join(__dirname, "..", "private-test-data", "seed");

// ---------------------------------------------------------------------------
// Seeded PRNG: mulberry32 (deterministic, fixed seed)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// CNPJ (numeric, 14 digits) with valid check digits.
// Port of src/lib/fiscal/cnpj.ts mod11 logic for digits only.
// ---------------------------------------------------------------------------
function mod11Digit(chars) {
  let sum = 0;
  let weight = 2;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    sum += (chars.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rem = sum % 11;
  return rem < 2 ? 0 : 11 - rem;
}
function computeCheckDigits(body12) {
  const d1 = mod11Digit(body12);
  const d2 = mod11Digit(body12 + String(d1));
  return `${d1}${d2}`;
}
function makeCnpj() {
  let body = "";
  for (let i = 0; i < 12; i += 1) body += String(randInt(0, 9));
  return body + computeCheckDigits(body);
}
function formatCnpj(n) {
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------
const COMPANY_NAMES = [
  "Indústria Metalúrgica Aurora Ltda",
  "Comércio de Insumos Borealis S.A.",
  "Distribuidora Céu Azul ME",
  "Têxtil Delta Norte EIRELI",
  "Agropecuária Estrela do Sul Ltda",
  "Logística Fênix Brasil Ltda",
  "Tecnologia Galáxia Software LTDA",
  "Alimentos Horizonte ME",
];
const UFS = ["SP", "RJ", "MG", "PR", "SC", "RS", "BA", "CE"];
const DOC_TYPES = ["nfe", "nfce", "cte", "nfse"];
const PERIODS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function buildCompanies() {
  const count = 6;
  const companies = [];
  for (let i = 0; i < count; i += 1) {
    const cnpj = makeCnpj();
    companies.push({
      id: `cmp_${String(i + 1).padStart(3, "0")}`,
      legalName: COMPANY_NAMES[i % COMPANY_NAMES.length],
      tradeName: COMPANY_NAMES[i % COMPANY_NAMES.length].split(" ")[0],
      cnpj,
      cnpjFormatted: formatCnpj(cnpj),
      uf: pick(UFS),
      regime: pick(["simples", "presumido", "real"]),
      active: i < 5, // 5 active, 1 inactive
      createdAt: `2026-0${1 + (i % 6)}-1${randInt(0, 9)}T12:00:00.000Z`,
    });
  }
  return companies;
}

function buildBatches(companies) {
  const batches = [];
  const n = 5;
  for (let i = 0; i < n; i += 1) {
    const company = companies[i % companies.length];
    const docCount = randInt(8, 24);
    const documents = [];
    let total = 0;
    for (let d = 0; d < docCount; d += 1) {
      const value = round2(randInt(50, 50000) + rng());
      total += value;
      documents.push({
        id: `doc_${i}_${d}`,
        type: pick(DOC_TYPES),
        accessKey: `NFe${makeCnpj()}${String(randInt(0, 9)).repeat(0)}${String(randInt(1, 9))}${"0".repeat(14)}`,
        emitterDoc: company.cnpj,
        number: randInt(1, 99999),
        series: randInt(1, 9),
        value,
        issuedAt: `2026-0${(i % 6) + 1}-1${randInt(0, 9)}T${String(randInt(0, 23)).padStart(2, "0")}:${String(randInt(0, 59)).padStart(2, "0")}:00.000Z`,
        status: pick(["imported", "validated", "flagged"]),
      });
    }
    batches.push({
      id: `batch_${String(i + 1).padStart(3, "0")}`,
      companyId: company.id,
      companyName: company.tradeName,
      period: PERIODS[i % PERIODS.length],
      uploadedAt: `2026-0${(i % 6) + 1}-1${randInt(0, 9)}T09:30:00.000Z`,
      documentCount: docCount,
      totalValue: round2(total),
      status: i < 4 ? "processed" : "pending",
      documents,
    });
  }
  return batches;
}

function buildReconciliation(batches) {
  const open = {
    id: "div_open_001",
    batchId: batches[0].id,
    type: "value_mismatch",
    severity: "high",
    status: "open",
    description: "Divergência de valor entre NF-e e livro fiscal (R$ 1.234,56).",
    expected: 12345.67,
    found: 11111.11,
    delta: round2(12345.67 - 11111.11),
    detectedAt: "2026-02-12T10:15:00.000Z",
    suggestedAction: "Conciliar lançamento complementar ou estorno.",
  };
  const resolved = {
    id: "div_resolved_001",
    batchId: batches[1].id,
    type: "missing_document",
    severity: "medium",
    status: "resolved",
    description: "Documento ausente localizado na segunda tentativa de importação.",
    expected: 890.0,
    found: 890.0,
    delta: 0,
    detectedAt: "2026-02-10T08:00:00.000Z",
    resolvedAt: "2026-02-11T14:20:00.000Z",
    resolutionNote: "Reimportado via lote complementar.",
  };
  return {
    id: "recon_001",
    companyId: batches[0].companyId,
    period: "2026-02",
    generatedAt: "2026-02-15T00:00:00.000Z",
    openCount: 1,
    resolvedCount: 1,
    totalImpacted: round2(open.expected),
    divergences: [open, resolved],
  };
}

function buildClosing() {
  const pending = [];
  const pendingTypes = ["apuracao_icms", "apuracao_ipi", "livro_entradas", "livro_saidas"];
  for (let i = 0; i < 4; i += 1) {
    pending.push({
      id: `close_pending_${String(i + 1).padStart(3, "0")}`,
      item: pendingTypes[i],
      status: "pending",
      value: round2(randInt(1000, 90000) + rng()),
      dueAt: "2026-03-20T23:59:00.000Z",
    });
  }
  const approved = {
    id: "close_approved_001",
    item: "balancete_fechamento",
    status: "approved",
    value: round2(1250000.0),
    approvedAt: "2026-03-05T16:45:00.000Z",
    approvedBy: "contador.demo@exemplo.com.br",
  };
  return {
    id: "closing_001",
    period: "2026-02",
    status: "in_progress",
    openedAt: "2026-03-01T00:00:00.000Z",
    pendingItems: pending,
    approvedItems: [approved],
    summary: {
      pendingCount: pending.length,
      approvedCount: 1,
      pendingTotal: round2(pending.reduce((s, p) => s + p.value, 0)),
    },
  };
}

function buildEfdGeneration() {
  return {
    id: "efd_001",
    establishmentCnpj: makeCnpj(),
    period: "2026-02",
    layout: "EFD ICMS/IPI",
    status: "pva_rejected",
    generatedAt: "2026-03-10T11:00:00.000Z",
    pva: {
      ranAt: "2026-03-10T11:05:00.000Z",
      result: "rejected",
      errors: [
        { code: "E001", message: "Bloco 0 — registro 0000 com período incompatível.", block: "0" },
        { code: "E042", message: "Totalizador do registro C100 diverge do livro.", block: "C" },
      ],
    },
    file: "EFD_ICMS_IPI_202602_REJ.txt",
  };
}

function buildBilling() {
  // A billing record that exists for the demo, plus an explicit absence marker
  // for a free-tier company that has never subscribed.
  return {
    hasRecord: true,
    record: {
      id: "bill_001",
      companyId: "cmp_001",
      plan: "pro_anual",
      status: "active",
      amountCents: 199900,
      currency: "BRL",
      cycle: "annual",
      nextChargeAt: "2027-01-01T00:00:00.000Z",
      provider: "stripe_demo",
    },
    absentFor: "cmp_006",
    absenceNote: "Company cmp_006 is on the free tier and has no billing record.",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const companies = buildCompanies();
  const batches = buildBatches(companies);
  const reconciliation = buildReconciliation(batches);
  const closing = buildClosing();
  const efd = buildEfdGeneration();
  const billing = buildBilling();

  const fixtures = {
    "companies.json": companies,
    "batches.json": batches,
    "reconciliation.json": reconciliation,
    "closing.json": closing,
    "efd-generation.json": efd,
    "billing.json": billing,
  };

  for (const [file, data] of Object.entries(fixtures)) {
    writeFileSync(join(OUT_DIR, file), JSON.stringify(data, null, 2) + "\n", "utf8");
  }

  const manifest = {
    seed: SEED,
    prng: "mulberry32",
    generatedAt: "deterministic-build-time-placeholder",
    description: "Deterministic synthetic seed data for populated UI states.",
    fixtures: [
      {
        file: "companies.json",
        entity: "companies",
        count: companies.length,
        notes: "Each company has a valid-format 14-digit CNPJ with correct check digits.",
      },
      {
        file: "batches.json",
        entity: "batches",
        count: batches.length,
        notes: "Each batch embeds documents with values, types, and access keys.",
      },
      {
        file: "reconciliation.json",
        entity: "reconciliation",
        count: 1,
        notes: "Contains exactly one open divergence and one resolved divergence.",
      },
      {
        file: "closing.json",
        entity: "closing",
        count: 1,
        notes: "Contains pending items and one approved item.",
      },
      {
        file: "efd-generation.json",
        entity: "efd_generation",
        count: 1,
        notes: "EFD generation with status pva_rejected and 2 PVA errors.",
      },
      {
        file: "billing.json",
        entity: "billing",
        count: 1,
        notes: "A billing record for cmp_001; explicit absence marker for cmp_006.",
      },
    ],
  };

  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  // eslint-disable-next-line no-console
  console.log(`[seed-demo] wrote ${Object.keys(fixtures).length} fixtures + manifest to ${OUT_DIR}`);
}

main();
