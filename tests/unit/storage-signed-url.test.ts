import { describe, expect, it } from "vitest";
import { LocalPrivateStorage, getStorageProvider } from "@/lib/storage/provider";

describe("storage providers", () => {
  it("defaults to local provider without supabase storage flag", () => {
    const prev = process.env.STORAGE_PROVIDER;
    process.env.STORAGE_PROVIDER = "local";
    expect(getStorageProvider()).toBeInstanceOf(LocalPrivateStorage);
    process.env.STORAGE_PROVIDER = prev;
  });

  it("local signed url is private path-shaped (not public CDN)", async () => {
    const local = new LocalPrivateStorage();
    const signed = await local.getSignedDownloadUrl({
      workspaceId: "ws_test",
      key: "a/b.xml",
      expiresInSeconds: 60,
    });
    expect(signed.url).toContain("/api/storage/local");
    expect(signed.url).not.toMatch(/^https?:\/\/.*supabase/);
    expect(signed.expiresAt).toBeTruthy();
  });
});
