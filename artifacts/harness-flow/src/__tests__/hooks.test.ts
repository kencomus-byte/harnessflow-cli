import { describe, it, expect } from "@jest/globals";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { HookRunner } from "../hooks/runner.js";
import { HookConfig } from "../types.js";

function makeTmpDir(): string {
  const dir = join(
    tmpdir(),
    `harness-hooks-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("HookRunner", () => {
  it("runs hooks that have no on_tools filter (apply to all tools)", async () => {
    const dir = makeTmpDir();
    try {
      const outputFile = join(dir, "hook_ran.txt");
      const scriptPath = join(dir, "hook.sh");
      writeFileSync(scriptPath, `#!/bin/sh\necho "ran" > "${outputFile}"\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = {
        script: "hook.sh",
      };

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
      const scriptPath = join(dir, "write-only.sh");
      writeFileSync(scriptPath, `#!/bin/sh\necho "wrote"\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = {
        script: "write-only.sh",
        on_tools: ["Write", "Edit"],
      };

      const results = await runner.runHooks([hook], "Read");
      expect(results).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("runs hooks whose on_tools list includes the triggering tool", async () => {
    const dir = makeTmpDir();
    try {
      const scriptPath = join(dir, "write-hook.sh");
      writeFileSync(scriptPath, `#!/bin/sh\necho "write hook ran"\n`, "utf8");

      const runner = new HookRunner(dir);
      const hook: HookConfig = {
        script: "write-hook.sh",
        on_tools: ["Write", "Edit"],
      };

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
      const hook: HookConfig = {
        script: "fail.sh",
        blocking: true,
      };

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
      const hook: HookConfig = {
        script: "fail.sh",
        blocking: false,
      };

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
      const hook: HookConfig = {
        script: "my-hook.sh",
      };

      const results = await runner.runHooks([hook]);
      expect(results[0].name).toBe("my-hook");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("skips missing script files gracefully", async () => {
    const dir = makeTmpDir();
    try {
      const runner = new HookRunner(dir);
      const hook: HookConfig = {
        script: "does-not-exist.sh",
        blocking: true,
      };

      const results = await runner.runHooks([hook]);
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].stdout).toContain("skipped");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
