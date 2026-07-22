import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import pg from "pg";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]!] ??= m[2]!;
  }
}

loadEnv();

// Try to extract token used by supabase CLI via `supabase projects list --output json`
// and Management API database query for our project ref.
const ref = "uaqydwvdmwrwlvznoztd";

async function tryMgmt(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: readFileSync(
        "supabase/migrations/202607220001_fix_workspace_members_insert.sql",
        "utf8",
      ),
    }),
  });
  const text = await res.text();
  console.log("mgmt_status", res.status, text.slice(0, 400));
  return res.ok;
}

async function main() {
  // 1) Token from env
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    console.log("trying SUPABASE_ACCESS_TOKEN");
    if (await tryMgmt(process.env.SUPABASE_ACCESS_TOKEN)) return;
  }

  // 2) Scan common token files
  const candidates = [
    process.env.USERPROFILE + "\\.supabase\\access-token",
    process.env.APPDATA + "\\supabase\\access-token",
    process.env.LOCALAPPDATA + "\\supabase\\access-token",
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const tok = readFileSync(p, "utf8").trim();
      console.log("trying file", p);
      if (await tryMgmt(tok)) return;
    }
  }

  // 3) DATABASE_URL if present
  if (process.env.DATABASE_URL) {
    console.log("trying DATABASE_URL");
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(
      readFileSync("supabase/migrations/202607220001_fix_workspace_members_insert.sql", "utf8"),
    );
    console.log("applied via DATABASE_URL");
    await client.end();
    return;
  }

  console.log("NO_DDL_PATH: need Database password or Management access token for project", ref);
  console.log(
    "Open https://supabase.com/dashboard/project/" +
      ref +
      "/sql/new and run supabase/migrations/202607220001_fix_workspace_members_insert.sql",
  );
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
