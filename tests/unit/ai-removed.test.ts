import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("AI product surface removed", () => {
  it("sidebar não aponta para /app/ai", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/layout/app-sidebar.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/\/app\/ai/);
    expect(src).not.toMatch(/IA \(demonstração\)/);
  });

  it("command palette não aponta para /app/ai", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/components/layout/command-palette.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/\/app\/ai/);
  });

  it(".env.example não documenta ENABLE_AI / AI_PROVIDER / OPENAI", () => {
    const env = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(env).not.toMatch(/ENABLE_AI/);
    expect(env).not.toMatch(/AI_PROVIDER/);
    expect(env).not.toMatch(/OPENAI_API_KEY/);
    expect(env).not.toMatch(/XAI_API_KEY/);
  });

  it("módulo src/modules/ai não existe mais", () => {
    const { existsSync } = require("fs") as typeof import("fs");
    expect(existsSync(path.join(process.cwd(), "src/modules/ai/index.ts"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "src/modules/ai/provider.ts"))).toBe(false);
  });
});
