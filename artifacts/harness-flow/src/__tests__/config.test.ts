import { describe, it, expect } from "@jest/globals";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { loadConfig, getDefaultConfigYaml } from "../config.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `harness-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadConfig", () => {
  it("returns defaults when no .harness.yaml exists", () => {
    const dir = makeTmpDir();
    try {
      const config = loadConfig(dir);
      expect(config.backend).toBe("claude");
      expect(config.guardrails.mode).toBe("normal");
      expect(config.context.project_file).toBe("CLAUDE.md");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads backend from .harness.yaml", () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, ".harness.yaml"), "backend: codex\n", "utf8");
      const config = loadConfig(dir);
      expect(config.backend).toBe("codex");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads guardrail mode from config", () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(
        join(dir, ".harness.yaml"),
        "guardrails:\n  mode: strict\n",
        "utf8"
      );
      const config = loadConfig(dir);
      expect(config.guardrails.mode).toBe("strict");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("falls back to defaults on invalid YAML", () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, ".harness.yaml"), ":::invalid yaml:::\n", "utf8");
      const config = loadConfig(dir);
      expect(config.backend).toBe("claude");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("getDefaultConfigYaml includes all required sections", () => {
    const yaml = getDefaultConfigYaml();
    expect(yaml).toContain("backend:");
    expect(yaml).toContain("guardrails:");
    expect(yaml).toContain("context:");
    expect(yaml).toContain("session:");
    expect(yaml).toContain("observability:");
    expect(yaml).toContain("hooks:");
  });
});
