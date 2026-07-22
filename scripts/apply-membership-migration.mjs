import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import pg from "pg";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    process.env[m[1]] = process.env[m[1]] || m[2];
  }
}

loadEnv();

const SQL = readFileSync(
  "supabase/migrations/202607220001_fix_workspace_members_insert.sql",
  "utf8",
);

async function applyViaPg(connectionString) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  await client.query(SQL);
  await client.end();
  console.log("APPLIED_OK via postgres");
}

async function verifyBlocked() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const emailA = `verify-a-${Date.now()}@example.com`;
  const emailB = `verify-b-${Date.now()}@example.com`;
  const pass = "TestPass123!secure";
  const { data: ua } = await admin.auth.admin.createUser({
    email: emailA,
    password: pass,
    email_confirm: true,
  });
  const { data: ub } = await admin.auth.admin.createUser({
    email: emailB,
    password: pass,
    email_confirm: true,
  });
  const wsA = crypto.randomUUID();
  const wsB = crypto.randomUUID();
  await admin.from("workspaces").insert([
    { id: wsA, name: "Verify A" },
    { id: wsB, name: "Verify B" },
  ]);
  await admin.from("workspace_members").insert([
    { workspace_id: wsA, user_id: ua.user.id, role: "owner" },
    { workspace_id: wsB, user_id: ub.user.id, role: "owner" },
  ]);
  const clientB = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await clientB.auth.signInWithPassword({ email: emailB, password: pass });
  const { error } = await clientB.from("workspace_members").insert({
    workspace_id: wsA,
    user_id: ub.user.id,
    role: "operator",
  });
  await admin.from("workspace_members").delete().in("workspace_id", [wsA, wsB]);
  await admin.from("workspaces").delete().in("id", [wsA, wsB]);
  await admin.auth.admin.deleteUser(ua.user.id);
  await admin.auth.admin.deleteUser(ub.user.id);
  if (error) {
    console.log("VERIFY_OK BOLA blocked:", error.message);
    return true;
  }
  console.log("VERIFY_FAIL still vulnerable");
  return false;
}

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.argv[2];
if (!dbUrl) {
  console.error(
    "Usage: node scripts/apply-membership-migration.mjs <postgres-connection-string>",
  );
  console.error(
    "Or set DATABASE_URL. Get it from Supabase → Project Settings → Database → Connection string (URI).",
  );
  process.exit(2);
}

await applyViaPg(dbUrl);
const ok = await verifyBlocked();
process.exit(ok ? 0 : 1);
