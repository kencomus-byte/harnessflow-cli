import { describe, it, expect } from "@jest/globals";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { loadConfig } from "../config.js";

function makeTmpDir(): string {
  const dir = join(
    tmpdir(),
    `harness-hook-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("Hook config schema compatibility", () => {
  it("loads hooks with no name field (name is optional)", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: claude
hooks:
  pre_tool:
    - script: scripts/typecheck.sh
      on_tools: [Write, Edit]
      blocking: true
  post_tool:
    - script: scripts/lint.sh
  on_session_end:
    - script: scripts/report.sh
      blocking: false
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.backend).toBe("claude");
      expect(config.hooks.pre_tool).toHaveLength(1);
      expect(config.hooks.pre_tool[0].script).toBe("scripts/typecheck.sh");
      expect(config.hooks.pre_tool[0].name).toBeUndefined();
      expect(config.hooks.pre_tool[0].on_tools).toEqual(["Write", "Edit"]);
      expect(config.hooks.pre_tool[0].blocking).toBe(true);

      expect(config.hooks.post_tool).toHaveLength(1);
      expect(config.hooks.post_tool[0].script).toBe("scripts/lint.sh");
      expect(config.hooks.post_tool[0].name).toBeUndefined();

      expect(config.hooks.on_session_end).toHaveLength(1);
      expect(config.hooks.on_session_end[0].script).toBe("scripts/report.sh");
      expect(config.hooks.on_session_end[0].blocking).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads hooks with name field (name is supported when provided)", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  pre_tool:
    - name: typecheck
      script: scripts/typecheck.sh
      on_tools: [Write, Edit]
      blocking: true
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.pre_tool[0].name).toBe("typecheck");
      expect(config.hooks.pre_tool[0].script).toBe("scripts/typecheck.sh");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("preserves guardrail and backend settings alongside hooks", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: codex
guardrails:
  mode: strict
  confirm_destructive: false
hooks:
  pre_tool:
    - script: scripts/check.sh
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.backend).toBe("codex");
      expect(config.guardrails.mode).toBe("strict");
      expect(config.guardrails.confirm_destructive).toBe(false);
      expect(config.hooks.pre_tool[0].script).toBe("scripts/check.sh");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
