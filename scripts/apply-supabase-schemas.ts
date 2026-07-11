/**
 * Apply all SQL schemas to a Postgres DATABASE_URL (Supabase).
 * Usage: DATABASE_URL=... npx tsx scripts/apply-supabase-schemas.ts
 */
import { readFileSync, readdirSync } from "fs";
import path from "path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL (Supabase Postgres connection string with password).");
    process.exit(1);
  }

  const pg = await import("pg").catch(() => null);
  if (!pg) {
    console.error("Install pg: npm install pg && npm install -D @types/pg");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const root = process.cwd();
  const files = [
    path.join(root, "supabase", "schema.sql"),
    path.join(root, "supabase", "schema-enterprise.sql"),
    ...readdirSync(path.join(root, "supabase", "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => path.join(root, "supabase", "migrations", f)),
  ];

  for (const file of files) {
    const sql = readFileSync(file, "utf8");
    console.log("Applying", path.relative(root, file));
    try {
      await client.query(sql);
    } catch (e) {
      console.error("Failed on", file, e);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("All schemas applied.");
}

main();
