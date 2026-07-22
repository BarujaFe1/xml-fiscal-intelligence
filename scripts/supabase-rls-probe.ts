import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    const val = m[2]!.replace(/^["']|["']$/g, "").trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !service || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANON_KEY in .env.local");
  }

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const mode = process.argv[2] || "probe";

  if (mode === "apply-sql") {
    const sql = readFileSync(
      "supabase/migrations/202607220001_fix_workspace_members_insert.sql",
      "utf8",
    );
    for (const fn of ["exec_sql", "execute_sql", "run_sql", "admin_exec_sql"]) {
      const { data, error } = await admin.rpc(fn, { query: sql });
      console.log(fn, error?.message || data);
    }
    return;
  }

  const { data: tables, error } = await admin.from("workspaces").select("id,name").limit(5);
  console.log("workspaces", error?.message || tables);

  for (const fn of ["exec_sql", "execute_sql", "run_sql"]) {
    const { data, error: e2 } = await admin.rpc(fn, { query: "select 1 as ok" });
    console.log(fn, e2?.message || data);
  }

  const emailA = `rls-a-${Date.now()}@example.com`;
  const emailB = `rls-b-${Date.now()}@example.com`;
  const pass = "TestPass123!secure";
  const { data: ua, error: ea } = await admin.auth.admin.createUser({
    email: emailA,
    password: pass,
    email_confirm: true,
  });
  const { data: ub, error: eb } = await admin.auth.admin.createUser({
    email: emailB,
    password: pass,
    email_confirm: true,
  });
  console.log("users", ea?.message || ua.user?.id, eb?.message || ub.user?.id);
  if (!ua?.user || !ub?.user) process.exit(1);

  const wsA = randomUUID();
  const wsB = randomUUID();
  const { error: werr } = await admin.from("workspaces").insert([
    { id: wsA, name: "RLS Test A" },
    { id: wsB, name: "RLS Test B" },
  ]);
  console.log("create ws", werr?.message || "ok");

  const { error: merr } = await admin.from("workspace_members").insert([
    { workspace_id: wsA, user_id: ua.user.id, role: "owner" },
    { workspace_id: wsB, user_id: ub.user.id, role: "owner" },
  ]);
  console.log("seed members", merr?.message || "ok");

  await admin.from("profiles").upsert([
    { id: ua.user.id, email: emailA },
    { id: ub.user.id, email: emailB },
  ]);

  const clientB = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginErr } = await clientB.auth.signInWithPassword({
    email: emailB,
    password: pass,
  });
  console.log("login B", loginErr?.message || "ok");

  const { error: ie } = await clientB.from("workspace_members").insert({
    workspace_id: wsA,
    user_id: ub.user.id,
    role: "operator",
  });
  console.log(
    "BOLA self-join attempt",
    ie ? `BLOCKED: ${ie.message}` : "VULNERABLE: insert succeeded",
  );

  const { data: leak, error: le } = await clientB
    .from("workspace_members")
    .select("workspace_id,user_id,role")
    .eq("workspace_id", wsA);
  console.log(
    "cross-read members of A as B",
    le?.message || `rows=${leak?.length ?? 0}`,
    JSON.stringify(leak),
  );

  await admin.from("workspace_members").delete().in("workspace_id", [wsA, wsB]);
  await admin.from("workspaces").delete().in("id", [wsA, wsB]);
  await admin.auth.admin.deleteUser(ua.user.id);
  await admin.auth.admin.deleteUser(ub.user.id);
  console.log("cleanup done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
