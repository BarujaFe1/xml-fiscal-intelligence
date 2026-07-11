/**
 * Private storage abstraction.
 * Local FS for privacy/dev; Supabase Storage for SaaS (signed URLs).
 * Never expose public buckets for fiscal XML.
 */

import path from "path";
import { hasServiceRole, createServiceClient } from "@/lib/auth/supabase-service";

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

function bucketName() {
  return process.env.STORAGE_BUCKET_XML || "xml-batches";
}

function objectPath(workspaceId: string, key: string) {
  return `${workspaceId}/${key}`.replace(/\/+/g, "/");
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

/** Supabase Storage with short-lived signed URLs (private bucket). */
export class SupabasePrivateStorage implements StorageProvider {
  async putObject(input: {
    workspaceId: string;
    key: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
  }): Promise<{ path: string }> {
    const supabase = createServiceClient();
    const objectKey = objectPath(input.workspaceId, input.key);
    const buf =
      typeof input.body === "string" ? Buffer.from(input.body, "utf8") : Buffer.from(input.body);
    const { error } = await supabase.storage.from(bucketName()).upload(objectKey, buf, {
      contentType: input.contentType || "application/octet-stream",
      upsert: true,
    });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
    return { path: objectKey };
  }

  async getSignedDownloadUrl(input: {
    workspaceId: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresAt: string }> {
    const supabase = createServiceClient();
    const objectKey = objectPath(input.workspaceId, input.key);
    const expiresIn = input.expiresInSeconds || 300;
    const { data, error } = await supabase.storage
      .from(bucketName())
      .createSignedUrl(objectKey, expiresIn);
    if (error || !data?.signedUrl) {
      throw new Error(`signed url failed: ${error?.message || "no url"}`);
    }
    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async getObject(input: { workspaceId: string; key: string }): Promise<Buffer> {
    const supabase = createServiceClient();
    const objectKey = objectPath(input.workspaceId, input.key);
    const { data, error } = await supabase.storage.from(bucketName()).download(objectKey);
    if (error || !data) throw new Error(`storage download failed: ${error?.message || "empty"}`);
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }
}

export function getStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
  if (provider === "supabase" && hasServiceRole()) {
    return new SupabasePrivateStorage();
  }
  return new LocalPrivateStorage();
}
