/**
 * Central import security limits — plan entitlements may tighten further at runtime.
 * Values chosen for browser memory safety (~hundreds of MB peak) on typical SaaS plans.
 */
export const IMPORT_LIMITS = {
  maxCompressedBytes: 50 * 1024 * 1024,
  maxUncompressedBytes: 250 * 1024 * 1024,
  maxFiles: 5000,
  maxSingleFileBytes: 15 * 1024 * 1024,
  maxCompressionRatio: 40,
  maxPathDepth: 12,
  maxProcessingMs: 10 * 60 * 1000,
  maxNestedZipDepth: 0,
  blockedExtensions: [
    ".exe",
    ".dll",
    ".bat",
    ".cmd",
    ".ps1",
    ".sh",
    ".js",
    ".mjs",
    ".vbs",
    ".scr",
  ],
} as const;

export type ImportLimits = typeof IMPORT_LIMITS;
