import pg from "pg";
import { readFileSync } from "fs";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    process.env[m[1]!] ??= m[2]!.replace(/^["']|["']$/g, "").trim();
  }
}

async function main() {
  loadEnvLocal();
  const secret = process.env.SUPABASE_SECRET_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const configs = [
    `postgresql://postgres:${encodeURIComponent(secret)}@db.uaqydwvdmwrwlvznoztd.supabase.co:5432/postgres`,
    `postgresql://postgres:${encodeURIComponent(service)}@db.uaqydwvdmwrwlvznoztd.supabase.co:5432/postgres`,
    `postgresql://postgres.uaqydwvdmwrwlvznoztd:${encodeURIComponent(secret)}@aws-1-sa-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.uaqydwvdmwrwlvznoztd:${encodeURIComponent(secret)}@aws-1-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.uaqydwvdmwrwlvznoztd:${encodeURIComponent(secret)}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
  ];

  for (const cs of configs) {
    const client = new pg.Client({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      const r = await client.query("select current_user as u");
      console.log("CONNECTED", r.rows[0], cs.split("@")[1]);
      await client.end();
      return;
    } catch (e) {
      console.log("fail", String((e as Error).message || "").slice(0, 140));
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
}

main();
