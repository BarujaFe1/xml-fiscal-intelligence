import fs from "fs/promises";
import path from "path";
import os from "os";
import type { BatchStore } from "@/types";

/**
 * Ephemeral/shared filesystem is NOT a durable multi-tenant store.
 * Always scope by ownerKey (authenticated user id or "local-dev").
 * On Vercel this lives under /tmp and remains non-durable — Supabase is the
 * production source of truth; this path is for local/dev and migration staging.
 */
function rootDir() {
  return process.env.VERCEL
    ? path.join(os.tmpdir(), "xml-fiscal-intelligence", "batches")
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "batches");
}

function sanitizeOwnerKey(ownerKey: string): string {
  const safe = ownerKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return safe || "anonymous";
}

function dataDir(ownerKey: string) {
  return path.join(rootDir(), sanitizeOwnerKey(ownerKey));
}

async function ensureDir(ownerKey: string) {
  await fs.mkdir(dataDir(ownerKey), { recursive: true });
}

function storePath(ownerKey: string, batchId: string) {
  const safeBatch = batchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(dataDir(ownerKey), `${safeBatch}.json`);
}

export async function listBatchStores(ownerKey: string): Promise<BatchStore[]> {
  await ensureDir(ownerKey);
  const dir = dataDir(ownerKey);
  const files = await fs.readdir(dir);
  const stores: BatchStore[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      stores.push(JSON.parse(raw) as BatchStore);
    } catch {
      // ignore corrupt
    }
  }
  return stores.sort(
    (a, b) => new Date(b.batch.createdAt).getTime() - new Date(a.batch.createdAt).getTime(),
  );
}

export async function getBatchStore(ownerKey: string, batchId: string): Promise<BatchStore | null> {
  try {
    const raw = await fs.readFile(storePath(ownerKey, batchId), "utf8");
    return JSON.parse(raw) as BatchStore;
  } catch {
    return null;
  }
}

export async function saveBatchStore(ownerKey: string, store: BatchStore): Promise<void> {
  await ensureDir(ownerKey);
  await fs.writeFile(storePath(ownerKey, store.batch.id), JSON.stringify(store), "utf8");
}

export async function deleteBatchStore(ownerKey: string, batchId: string): Promise<boolean> {
  try {
    await fs.unlink(storePath(ownerKey, batchId));
    const xmlDir = path.join(dataDir(ownerKey), batchId.replace(/[^a-zA-Z0-9_-]/g, "_"));
    await fs.rm(xmlDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function saveRawXml(ownerKey: string, batchId: string, fileName: string, xml: string) {
  const safeBatch = batchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join(dataDir(ownerKey), safeBatch, "xml");
  await fs.mkdir(dir, { recursive: true });
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  const filePath = path.join(dir, safe);
  // Zip-slip guard: resolve and ensure under dir
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir)) {
    throw new Error("Caminho de XML inválido");
  }
  await fs.writeFile(resolved, xml, "utf8");
  return resolved;
}

export async function readRawXml(storedPath: string) {
  try {
    return await fs.readFile(storedPath, "utf8");
  } catch {
    const full = path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath);
    return fs.readFile(full, "utf8");
  }
}

export const DEFAULT_WORKSPACE_ID = "ws_local_demo";
