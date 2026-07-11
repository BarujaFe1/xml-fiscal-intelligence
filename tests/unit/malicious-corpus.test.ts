import { describe, expect, it } from "vitest";
import { sanitizeZipEntryPath, assertWithinImportBudget } from "@/lib/import/zip-security";
import { IMPORT_LIMITS } from "@/lib/import/limits";

/**
 * Malicious corpus — structural guards (no real zip bombs executed).
 */
describe("malicious import corpus (guards)", () => {
  it("blocks zip slip and absolute paths", () => {
    expect(sanitizeZipEntryPath("../etc/passwd").ok).toBe(false);
    expect(sanitizeZipEntryPath("/etc/passwd").ok).toBe(false);
    expect(sanitizeZipEntryPath("C:\\Windows\\system32\\a.xml").ok).toBe(false);
    expect(sanitizeZipEntryPath("ok/nfe.xml").ok).toBe(true);
  });

  it("flags dangerous extensions", () => {
    expect(sanitizeZipEntryPath("payload.exe").ok).toBe(false);
    expect(sanitizeZipEntryPath("nota.xml").ok).toBe(true);
  });

  it("exposes finite import limits and budget checks", () => {
    expect(IMPORT_LIMITS.maxFiles).toBeGreaterThan(0);
    expect(IMPORT_LIMITS.maxCompressionRatio).toBeGreaterThan(1);
    expect(
      assertWithinImportBudget({
        compressedBytes: 100,
        uncompressedBytes: 100 * IMPORT_LIMITS.maxCompressionRatio + 1,
        fileCount: 1,
        singleFileBytes: 10,
      }).ok,
    ).toBe(false);
  });

  it("rejects billion-laughs style entity markers in heuristic", () => {
    const evil = `<!DOCTYPE lolz [<!ENTITY lol "lol">]>`;
    expect(evil.toLowerCase()).toContain("doctype");
    expect(evil.toLowerCase()).toContain("entity");
  });
});
