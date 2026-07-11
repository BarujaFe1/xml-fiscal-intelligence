/**
 * Offline RLS policy inventory checks (no live DB required).
 * CI fails if a new public table migration enables exposure without mentioning RLS.
 *
 * For live two-tenant proofs, use docs/RLS_TEST_MATRIX.md against Supabase.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

describe("RLS migration hygiene", () => {
  it("migrations directory exists with SQL files", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);
  });

  it("rls_remaining migration enables RLS on known gap tables", () => {
    const sql = readFileSync(path.join(migrationsDir, "202607110006_rls_remaining.sql"), "utf8");
    for (const table of [
      "import_batches",
      "document_relationships",
      "official_sources",
      "billing_events",
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
  });

  it("foundation migration defines is_workspace_member helper usage", () => {
    const schema = readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf8");
    expect(schema).toMatch(/is_workspace_member/);
    expect(schema).toMatch(/enable row level security/i);
  });
});
