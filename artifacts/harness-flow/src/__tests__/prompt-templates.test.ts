import { describe, it, expect } from "@jest/globals";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { HarnessConfigSchema } from "../types.js";
import { PromptEngine } from "../prompt/engine.js";

function makeTmpDir(): string {
  return mkdtempSync(resolve(tmpdir(), "harness-prompts-"));
}

describe("PromptEngine — handoff and verification templates", () => {
  it("buildHandoffPrompt returns default template with task injected", () => {
    const dir = makeTmpDir();
    try {
      const config = HarnessConfigSchema.parse({});
      const engine = new PromptEngine(dir, config);
      const result = engine.buildHandoffPrompt("Add login feature");
      expect(result).toContain("Add login feature");
      expect(result).toContain("handoff");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("buildHandoffPrompt uses custom template when handoff.md exists in prompts dir", () => {
    const dir = makeTmpDir();
    try {
      const promptDir = resolve(dir, ".harness", "prompts");
      mkdirSync(promptDir, { recursive: true });
      writeFileSync(
        resolve(promptDir, "handoff.md"),
        "Custom handoff for: {{task}}",
        "utf8"
      );

      const config = HarnessConfigSchema.parse({});
      const engine = new PromptEngine(dir, config);
      const result = engine.buildHandoffPrompt("Fix the bug");
      expect(result).toBe("Custom handoff for: Fix the bug");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("buildVerificationPrompt returns default template with task injected", () => {
    const dir = makeTmpDir();
    try {
      const config = HarnessConfigSchema.parse({});
      const engine = new PromptEngine(dir, config);
      const result = engine.buildVerificationPrompt("Write tests for auth module");
      expect(result).toContain("Write tests for auth module");
      expect(result).toContain("verify");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("buildVerificationPrompt uses custom template when verification.md exists", () => {
    const dir = makeTmpDir();
    try {
      const promptDir = resolve(dir, ".harness", "prompts");
      mkdirSync(promptDir, { recursive: true });
      writeFileSync(
        resolve(promptDir, "verification.md"),
        "Verify this: {{task}}",
        "utf8"
      );

      const config = HarnessConfigSchema.parse({});
      const engine = new PromptEngine(dir, config);
      const result = engine.buildVerificationPrompt("Build payment flow");
      expect(result).toBe("Verify this: Build payment flow");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
