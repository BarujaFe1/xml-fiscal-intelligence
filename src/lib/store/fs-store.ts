import fs from "fs/promises";
import path from "path";
import os from "os";
import type { BatchStore } from "@/types";

// On Vercel the filesystem is ephemeral — use /tmp. Locally persist under ./data/batches.
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "xml-fiscal-intelligence", "batches")
  : path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "batches");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function storePath(batchId: string) {
  return path.join(DATA_DIR, `${batchId}.json`);
}

export async function listBatchStores(): Promise<BatchStore[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const stores: BatchStore[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
      stores.push(JSON.parse(raw) as BatchStore);
    } catch {
      // ignore corrupt
    }
  }
  return stores.sort(
    (a, b) => new Date(b.batch.createdAt).getTime() - new Date(a.batch.createdAt).getTime(),
  );
}

export async function getBatchStore(batchId: string): Promise<BatchStore | null> {
  try {
    const raw = await fs.readFile(storePath(batchId), "utf8");
    return JSON.parse(raw) as BatchStore;
  } catch {
    return null;
  }
}

export async function saveBatchStore(store: BatchStore): Promise<void> {
  await ensureDir();
  await fs.writeFile(storePath(store.batch.id), JSON.stringify(store), "utf8");
}

export async function deleteBatchStore(batchId: string): Promise<boolean> {
  try {
    await fs.unlink(storePath(batchId));
    const xmlDir = path.join(DATA_DIR, batchId);
    await fs.rm(xmlDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function saveRawXml(batchId: string, fileName: string, xml: string) {
  const dir = path.join(DATA_DIR, batchId, "xml");
  await fs.mkdir(dir, { recursive: true });
  const safe = fileName.replace(/[^\w.\-]+/g, "_");
  const filePath = path.join(dir, safe);
  await fs.writeFile(filePath, xml, "utf8");
  return filePath;
}

export async function readRawXml(storedPath: string) {
  // Prefer absolute path written by saveRawXml; fall back to cwd-relative for older records
  try {
    return await fs.readFile(storedPath, "utf8");
  } catch {
    const full = path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath);
    return fs.readFile(full, "utf8");
  }
}

export const DEFAULT_WORKSPACE_ID = "ws_local_demo";
