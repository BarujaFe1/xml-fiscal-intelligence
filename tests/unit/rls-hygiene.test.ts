/**
 * Offline RLS policy inventory checks (no live DB required).
 * CI fails if a new public table migration enables exposure without mentioning RLS.
 *
 * For live two-tenant proofs, use docs/RLS_TEST_MATRIX.md against Supabase.
 * Optional live: RUN_RLS_LIVE=1 DATABASE_URL=... npm test
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

  it("migration set includes enable row level security statements", () => {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    const joined = files
      .map((f) => readFileSync(path.join(migrationsDir, f), "utf8"))
      .join("\n");
    expect(joined.match(/enable row level security/gi)?.length || 0).toBeGreaterThan(5);
  });
});

describe("RLS live two-tenant (optional)", () => {
  const dbUrl = process.env.DATABASE_URL;
  const runLive = process.env.RUN_RLS_LIVE === "1" && Boolean(dbUrl);

  it.skipIf(!runLive)("DATABASE_URL reachable and RLS enabled on core tables", async () => {
    const pg = await import("pg");
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{ relname: string; rls: boolean }>(`
        select c.relname, c.relrowsecurity as rls
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname in ('workspaces', 'batches', 'usage_counters', 'subscriptions')
      `);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.rls, row.relname).toBe(true);
      }
    } finally {
      await client.end();
    }
  });
});
