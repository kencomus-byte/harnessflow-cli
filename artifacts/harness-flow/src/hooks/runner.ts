import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { resolve } from "path";
import { HookConfig, HookResult } from "../types.js";

const execFileAsync = promisify(execFile);

export class HookRunner {
  constructor(private projectRoot: string) {}

  async runHooks(
    hooks: HookConfig[],
    triggeredByTool?: string
  ): Promise<HookResult[]> {
    const results: HookResult[] = [];

    for (const hook of hooks) {
      if (triggeredByTool && hook.on_tools && !hook.on_tools.includes(triggeredByTool)) {
        continue;
      }

      const result = await this.runSingleHook(hook);
      results.push(result);

      if (hook.blocking && !result.passed) {
        throw new HookFailedError(hook.name, result.stderr || result.stdout);
      }
    }

    return results;
  }

  private async runSingleHook(hook: HookConfig): Promise<HookResult> {
    const scriptPath = resolve(this.projectRoot, hook.script);
    const startMs = Date.now();

    if (!existsSync(scriptPath)) {
      return {
        name: hook.name,
        exitCode: 0,
        stdout: `[Hook skipped: ${hook.script} not found]`,
        stderr: "",
        durationMs: 0,
        passed: true,
      };
    }

    try {
      const { stdout, stderr } = await execFileAsync("sh", [scriptPath], {
        cwd: this.projectRoot,
        timeout: (hook.timeout ?? 30) * 1000,
      });

      return {
        name: hook.name,
        exitCode: 0,
        stdout,
        stderr,
        durationMs: Date.now() - startMs,
        passed: true,
      };
    } catch (err: unknown) {
      const e = err as { code?: number; stdout?: string; stderr?: string };
      return {
        name: hook.name,
        exitCode: e.code ?? 1,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? String(err),
        durationMs: Date.now() - startMs,
        passed: false,
      };
    }
  }
}

export class HookFailedError extends Error {
  constructor(
    public hookName: string,
    public output: string
  ) {
    super(`Hook "${hookName}" failed:\n${output}`);
    this.name = "HookFailedError";
  }
}
