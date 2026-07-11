/**
 * App release stamp — single source for UI, health, and export manifests.
 */
export type ReleaseInfo = {
  appVersion: string;
  buildCommit: string;
  buildTime: string | null;
  channel: "local" | "preview" | "production" | "unknown";
};

export function getReleaseInfo(): ReleaseInfo {
  const appVersion =
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.npm_package_version ||
    "0.1.0";
  const buildCommit =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    "local";
  const env = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const channel =
    env === "production" || env === "preview" ? env : buildCommit === "local" ? "local" : "unknown";
  return {
    appVersion,
    buildCommit: buildCommit.slice(0, 12),
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null,
    channel,
  };
}

export function formatReleaseLabel(info: ReleaseInfo = getReleaseInfo()): string {
  return `v${info.appVersion} · ${info.buildCommit}`;
}
