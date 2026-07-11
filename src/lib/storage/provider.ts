/**
 * Private storage abstraction.
 * Local FS for privacy/dev; Supabase Storage for SaaS (signed URLs).
 * Never expose public buckets for fiscal XML.
 */

import path from "path";

export interface StorageProvider {
  putObject(input: {
    workspaceId: string;
    key: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
  }): Promise<{ path: string }>;
  getSignedDownloadUrl(input: {
    workspaceId: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresAt: string }>;
  getObject(input: { workspaceId: string; key: string }): Promise<Buffer>;
}

function rootDir() {
  return (
    process.env.LOCAL_STORAGE_ROOT ||
    path.join(/* turbopackIgnore: true */ process.cwd(), "private-data", "storage")
  );
}

export class LocalPrivateStorage implements StorageProvider {
  async putObject(input: {
    workspaceId: string;
    key: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
  }): Promise<{ path: string }> {
    const { mkdir, writeFile } = await import("fs/promises");
    const full = path.join(rootDir(), input.workspaceId, input.key);
    await mkdir(path.dirname(full), { recursive: true });
    const buf =
      typeof input.body === "string" ? Buffer.from(input.body, "utf8") : Buffer.from(input.body);
    await writeFile(full, buf);
    return { path: `${input.workspaceId}/${input.key}` };
  }

  async getSignedDownloadUrl(input: {
    workspaceId: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresAt: string }> {
    const expiresAt = new Date(
      Date.now() + (input.expiresInSeconds || 300) * 1000,
    ).toISOString();
    return {
      url: `/api/storage/local?w=${encodeURIComponent(input.workspaceId)}&k=${encodeURIComponent(input.key)}`,
      expiresAt,
    };
  }

  async getObject(input: { workspaceId: string; key: string }): Promise<Buffer> {
    const { readFile } = await import("fs/promises");
    const full = path.join(rootDir(), input.workspaceId, input.key);
    return readFile(full);
  }
}

export function getStorageProvider(): StorageProvider {
  return new LocalPrivateStorage();
}
