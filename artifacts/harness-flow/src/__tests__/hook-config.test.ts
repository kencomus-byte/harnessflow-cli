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

describe("Hook config schema — backward-compatible script hooks", () => {
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

describe("Hook config schema — new hook events", () => {
  it("loads on_session_start hooks", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  on_session_start:
    - name: setup
      script: .harness/hooks/setup.sh
      blocking: true
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.on_session_start).toHaveLength(1);
      expect(config.hooks.on_session_start[0].name).toBe("setup");
      expect(config.hooks.on_session_start[0].script).toBe(".harness/hooks/setup.sh");
      expect(config.hooks.on_session_start[0].blocking).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads on_user_prompt hooks", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  on_user_prompt:
    - name: injection-check
      script: .harness/hooks/check-prompt.sh
      blocking: true
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.on_user_prompt).toHaveLength(1);
      expect(config.hooks.on_user_prompt[0].name).toBe("injection-check");
      expect(config.hooks.on_user_prompt[0].blocking).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads post_tool_failure hooks", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  post_tool_failure:
    - name: on-error
      script: .harness/hooks/on-error.sh
      blocking: false
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.post_tool_failure).toHaveLength(1);
      expect(config.hooks.post_tool_failure[0].name).toBe("on-error");
      expect(config.hooks.post_tool_failure[0].blocking).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads on_stop hooks", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  on_stop:
    - name: verify-quality
      script: .harness/hooks/verify.sh
      blocking: true
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.on_stop).toHaveLength(1);
      expect(config.hooks.on_stop[0].name).toBe("verify-quality");
      expect(config.hooks.on_stop[0].blocking).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads all 7 hook event types together", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  on_session_start:
    - script: hooks/start.sh
  on_user_prompt:
    - script: hooks/prompt.sh
  pre_tool:
    - script: hooks/pre.sh
  post_tool:
    - script: hooks/post.sh
  post_tool_failure:
    - script: hooks/failure.sh
  on_stop:
    - script: hooks/stop.sh
  on_session_end:
    - script: hooks/end.sh
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.on_session_start).toHaveLength(1);
      expect(config.hooks.on_user_prompt).toHaveLength(1);
      expect(config.hooks.pre_tool).toHaveLength(1);
      expect(config.hooks.post_tool).toHaveLength(1);
      expect(config.hooks.post_tool_failure).toHaveLength(1);
      expect(config.hooks.on_stop).toHaveLength(1);
      expect(config.hooks.on_session_end).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("Hook config schema — handler types", () => {
  it("loads prompt handler hooks", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  pre_tool:
    - name: security-review
      handler: prompt
      evaluation_prompt: "Is this tool call safe? PASS or FAIL."
      on_tools: [Bash]
      blocking: true
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.pre_tool[0].handler).toBe("prompt");
      expect(config.hooks.pre_tool[0].evaluation_prompt).toBe("Is this tool call safe? PASS or FAIL.");
      expect(config.hooks.pre_tool[0].on_tools).toEqual(["Bash"]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads agent handler hooks", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  on_stop:
    - name: verify-agent
      handler: agent
      agent_task: "Verify that all tests are passing"
      blocking: true
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.on_stop[0].handler).toBe("agent");
      expect(config.hooks.on_stop[0].agent_task).toBe("Verify that all tests are passing");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("loads script handler with modify_input=true", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  pre_tool:
    - name: sanitize
      handler: script
      script: hooks/sanitize.sh
      modify_input: true
      on_tools: [Bash]
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.pre_tool[0].modify_input).toBe(true);
      expect(config.hooks.pre_tool[0].script).toBe("hooks/sanitize.sh");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("defaults handler to 'script' when not specified", () => {
    const dir = makeTmpDir();
    try {
      const yaml = `
backend: dry-run
hooks:
  pre_tool:
    - script: hooks/check.sh
`;
      writeFileSync(join(dir, ".harness.yaml"), yaml, "utf8");
      const config = loadConfig(dir);

      expect(config.hooks.pre_tool[0].handler).toBe("script");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
