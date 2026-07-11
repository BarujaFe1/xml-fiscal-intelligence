/**
 * Upsert Supabase-related env vars from .env.local into the Vercel project.
 *
 * Requires a token from the SAME Vercel team that owns the project
 * (barujafe1s-projects / team_Dj88L2uetUzQOe8nAbXT8lJX):
 *
 *   set VERCEL_TOKEN=...   (https://vercel.com/account/tokens)
 *   node scripts/sync-vercel-env.mjs
 *
 * Does not print secret values.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";

const PROJECT_ID = "prj_yInyTQsC3YUEHuLZ96PgUF5HRoCk";
const TEAM_ID = "team_Dj88L2uetUzQOe8nAbXT8lJX";
const TARGETS = ["production", "preview", "development"];

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FEATURE_CLOUD_PROCESSING",
  "NEXT_PUBLIC_FEATURE_CLOUD_PROCESSING",
];

function parseEnvLocal(filePath) {
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function main() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error("Missing VERCEL_TOKEN (create at vercel.com/account/tokens on barujafe1 team).");
    process.exit(1);
  }
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.error(".env.local not found");
    process.exit(1);
  }
  const local = parseEnvLocal(envPath);
  // Prefer MCP-known URL if local blank
  if (!local.NEXT_PUBLIC_SUPABASE_URL) {
    local.NEXT_PUBLIC_SUPABASE_URL = "https://uaqydwvdmwrwlvznoztd.supabase.co";
  }
  if (!local.FEATURE_CLOUD_PROCESSING) local.FEATURE_CLOUD_PROCESSING = "true";
  if (!local.NEXT_PUBLIC_FEATURE_CLOUD_PROCESSING) {
    local.NEXT_PUBLIC_FEATURE_CLOUD_PROCESSING = "true";
  }

  const body = [];
  for (const key of KEYS) {
    const value = local[key];
    if (!value) {
      console.warn(`skip ${key}: empty in .env.local`);
      continue;
    }
    body.push({
      key,
      value,
      type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
      target: TARGETS,
    });
    console.log(`queue ${key} (${value.length} chars)`);
  }

  if (!body.length) {
    console.error("Nothing to sync");
    process.exit(1);
  }

  const url = `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?upsert=true&teamId=${TEAM_ID}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Vercel API ${res.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`OK upserted ${body.length} env vars (production+preview+development). Redeploy required.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
