import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { resolve, basename } from "path";
import { HookConfig, HookResult } from "../types.js";

const execFileAsync = promisify(execFile);

export class HookRunner {
  constructor(private projectRoot: string) {}

  /**
   * Run hooks filtered by triggeredByTool.
   * - If triggeredByTool is provided, only hooks whose `on_tools` list includes it are run.
   * - Hooks with no `on_tools` list always run (they apply to all tools).
   */
  async runHooks(
    hooks: HookConfig[],
    triggeredByTool?: string
  ): Promise<HookResult[]> {
    const results: HookResult[] = [];

    for (const hook of hooks) {
      if (
        triggeredByTool !== undefined &&
        hook.on_tools !== undefined &&
        !hook.on_tools.includes(triggeredByTool)
      ) {
        continue;
      }

      const result = await this.runSingleHook(hook);
      results.push(result);

      if (hook.blocking && !result.passed) {
        throw new HookFailedError(result.name, result.stderr || result.stdout);
      }
    }

    return results;
  }

  private async runSingleHook(hook: HookConfig): Promise<HookResult> {
    const scriptPath = resolve(this.projectRoot, hook.script);
    const hookName = hook.name ?? basename(hook.script, ".sh");
    const startMs = Date.now();

    if (!existsSync(scriptPath)) {
      if (hook.blocking) {
        return {
          name: hookName,
          exitCode: 1,
          stdout: "",
          stderr: `Blocking hook "${hookName}" script not found: ${hook.script}`,
          durationMs: 0,
          passed: false,
        };
      }
      return {
        name: hookName,
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
        name: hookName,
        exitCode: 0,
        stdout,
        stderr,
        durationMs: Date.now() - startMs,
        passed: true,
      };
    } catch (err: unknown) {
      const e = err as { code?: number; stdout?: string; stderr?: string };
      return {
        name: hookName,
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
