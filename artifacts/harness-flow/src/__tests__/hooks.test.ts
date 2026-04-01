import { describe, it, expect } from "@jest/globals";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { HookRunner } from "../hooks/runner.js";
import { HookConfig, HookContext } from "../types.js";

function makeTmpDir(): string {
  const dir = join(
    tmpdir(),
    `harness-hooks-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeCtx(dir: string, overrides: Partial<HookContext> = {}): HookContext {
  return {
    session_id: "test-session",
    cwd: dir,
    hook_event: "test",
    ...overrides,
  };
}

describe("HookRunner — legacy runHooks()", () => {
  it("runs hooks that have no on_tools filter (apply to all tools)", async () => {
    const dir = makeTmpDir();
    try {
      const outputFile = join(dir, "hook_ran.txt");
      const scriptPath = join(dir, "hook.sh");
      writeFileSync(scriptPath, `#!/bin/sh\necho "ran" > "${outputFile}"\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = { script: "hook.sh" };

      const results = await runner.runHooks([hook], "Read");
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("skips hooks whose on_tools list does not include the triggering tool", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "write-only.sh"), `#!/bin/sh\necho "wrote"\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = { script: "write-only.sh", on_tools: ["Write", "Edit"] };

      const results = await runner.runHooks([hook], "Read");
      expect(results).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("runs hooks whose on_tools list includes the triggering tool", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "write-hook.sh"), `#!/bin/sh\necho "write hook ran"\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = { script: "write-hook.sh", on_tools: ["Write", "Edit"] };

      const results = await runner.runHooks([hook], "Write");
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("runs all hooks when no tool is specified (session end scenario)", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "a.sh"), `#!/bin/sh\necho "a"\n`, "utf8");
      writeFileSync(join(dir, "b.sh"), `#!/bin/sh\necho "b"\n`, "utf8");

      const runner = new HookRunner(dir);
      const hooks: HookConfig[] = [
        { script: "a.sh" },
        { script: "b.sh", on_tools: ["Write"] },
      ];

      const results = await runner.runHooks(hooks);
      expect(results).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("throws HookFailedError when blocking hook fails", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "fail.sh"), `#!/bin/sh\nexit 1\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = { script: "fail.sh", blocking: true };

      await expect(runner.runHooks([hook], "Bash")).rejects.toThrow("failed");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("does not throw when non-blocking hook fails", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "fail.sh"), `#!/bin/sh\nexit 1\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = { script: "fail.sh", blocking: false };

      const results = await runner.runHooks([hook]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("auto-derives hook name from script filename when name is omitted", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "my-hook.sh"), `#!/bin/sh\nexit 0\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = { script: "my-hook.sh" };

      const results = await runner.runHooks([hook]);
      expect(results[0].name).toBe("my-hook");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("skips missing script files gracefully when non-blocking", async () => {
    const dir = makeTmpDir();
    try {
      const runner = new HookRunner(dir);
      const hook: HookConfig = { script: "does-not-exist.sh", blocking: false };

      const results = await runner.runHooks([hook]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].stdout).toContain("skipped");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("throws HookFailedError when blocking hook script is missing", async () => {
    const dir = makeTmpDir();
    try {
      const runner = new HookRunner(dir);
      const hook: HookConfig = { script: "does-not-exist.sh", blocking: true };

      await expect(runner.runHooks([hook])).rejects.toThrow(/Hook.*failed/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("HookRunner — runTypedHooks() with new hook events", () => {
  it("passes JSON context via stdin to hook script", async () => {
    const dir = makeTmpDir();
    try {
      const captureFile = join(dir, "captured.json");
      writeFileSync(
        join(dir, "capture.sh"),
        `#!/bin/sh\ncat > "${captureFile}"\n`,
        "utf8"
      );

      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "session_start", task: "build feature X" });

      await runner.runTypedHooks(
        [{ handler: "script", script: "capture.sh", blocking: false, timeout: 10, modify_input: false, allowed_tools: [] }],
        ctx
      );

      const { readFileSync } = await import("fs");
      const captured = JSON.parse(readFileSync(captureFile, "utf8")) as Record<string, unknown>;
      expect(captured.hook_event).toBe("session_start");
      expect(captured.session_id).toBe("test-session");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("filters by on_tools when triggeredByTool is provided", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "bash-only.sh"), `#!/bin/sh\necho "ran"\n`, "utf8");

      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "pre_tool_use", tool_name: "Read" });

      const results = await runner.runTypedHooks(
        [{ handler: "script", script: "bash-only.sh", on_tools: ["Bash"], blocking: false, timeout: 10, modify_input: false, allowed_tools: [] }],
        ctx,
        "Read"
      );

      expect(results).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("runs script with no on_tools filter for any tool", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "any.sh"), `#!/bin/sh\nexit 0\n`, "utf8");

      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "post_tool_use", tool_name: "Write" });

      const results = await runner.runTypedHooks(
        [{ handler: "script", script: "any.sh", blocking: false, timeout: 10, modify_input: false, allowed_tools: [] }],
        ctx,
        "Write"
      );

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("prompt handler skips gracefully when claude is not available", async () => {
    const dir = makeTmpDir();
    try {
      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "pre_tool_use" });

      const results = await runner.runTypedHooks(
        [{ handler: "prompt", evaluation_prompt: "Is this safe? PASS or FAIL.", blocking: false, timeout: 5, allowed_tools: [] }],
        ctx
      );

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].stdout).toContain("not available");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("agent handler skips gracefully when claude is not available", async () => {
    const dir = makeTmpDir();
    try {
      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "on_stop" });

      const results = await runner.runTypedHooks(
        [{ handler: "agent", agent_task: "Verify tests pass", allowed_tools: ["Read", "Grep"], blocking: false, timeout: 5 }],
        ctx
      );

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("HookRunner — runPreToolHooks() with modify_input", () => {
  it("returns modifiedArgs when hook outputs JSON with modified_args key", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(
        join(dir, "sanitize.sh"),
        `#!/bin/sh\necho '{"modified_args":{"command":"echo safe"}}'`,
        "utf8"
      );

      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "pre_tool_use", tool_name: "Bash", tool_args: { command: "rm -rf /tmp/test" } });

      const { results, modifiedArgs } = await runner.runPreToolHooks(
        [{ handler: "script", script: "sanitize.sh", modify_input: true, on_tools: ["Bash"], blocking: true, timeout: 10, allowed_tools: [] }],
        ctx
      );

      expect(results).toHaveLength(1);
      expect(modifiedArgs).toBeDefined();
      expect(modifiedArgs?.command).toBe("echo safe");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("returns no modifiedArgs when modify_input is false", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(
        join(dir, "noop.sh"),
        `#!/bin/sh\necho '{"modified_args":{"command":"injected"}}'`,
        "utf8"
      );

      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "pre_tool_use", tool_name: "Bash" });

      const { modifiedArgs } = await runner.runPreToolHooks(
        [{ handler: "script", script: "noop.sh", modify_input: false, blocking: false, timeout: 10, allowed_tools: [] }],
        ctx
      );

      expect(modifiedArgs).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("skips hooks whose on_tools does not match tool_name", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "write-only.sh"), `#!/bin/sh\nexit 0\n`, "utf8");

      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "pre_tool_use", tool_name: "Read" });

      const { results } = await runner.runPreToolHooks(
        [{ handler: "script", script: "write-only.sh", on_tools: ["Write"], modify_input: true, blocking: true, timeout: 10, allowed_tools: [] }],
        ctx
      );

      expect(results).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("HookRunner — runStopHooks() with exit code 2", () => {
  it("returns shouldContinue=true when hook exits with code 2", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "force-continue.sh"), `#!/bin/sh\necho "tests not passing" >&2\nexit 2\n`, "utf8");

      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "stop" });

      const { shouldContinue, results } = await runner.runStopHooks(
        [{ handler: "script", script: "force-continue.sh", blocking: true, timeout: 10 }],
        ctx
      );

      expect(shouldContinue).toBe(true);
      expect(results[0].forceContinue).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("returns shouldContinue=false when hook exits with code 0", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "ok.sh"), `#!/bin/sh\necho "all good"\nexit 0\n`, "utf8");

      const runner = new HookRunner(dir);
      const ctx = makeCtx(dir, { hook_event: "stop" });

      const { shouldContinue } = await runner.runStopHooks(
        [{ handler: "script", script: "ok.sh", blocking: false, timeout: 10 }],
        ctx
      );

      expect(shouldContinue).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
