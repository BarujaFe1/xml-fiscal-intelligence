// tests/unit/screenshot-manifest.test.ts
//
// Gate over the UI-capture matrix. Skipped unless XFI_CHECK_SCREENSHOTS=1 so it
// does not break the default unit suite when screenshots haven't been captured.
// Run as part of the capture pipeline via: npm run screenshots:verify

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { checkMatrix } from "../../scripts/lib/matrix-check.mjs";

const OUT_DIR = resolve(__dirname, "..", "..", "artifacts", "ui-capture", "after");

describe.skipIf(!process.env.XFI_CHECK_SCREENSHOTS)("UI-capture matrix integrity", () => {
  const { ok, violations, summary } = checkMatrix(OUT_DIR);

  it("reports a complete, differentiated matrix", () => {
    if (!ok) {
      console.error(JSON.stringify(violations, null, 2));
    }
    expect(ok, "matrix violations present").toBe(true);
    expect(summary.shotCount).toBeGreaterThan(0);
  });
});
