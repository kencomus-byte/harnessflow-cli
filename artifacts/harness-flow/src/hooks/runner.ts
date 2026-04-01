import { spawn } from "child_process";
import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { resolve, basename } from "path";
import { HookConfig, HookResult, HookContext, HookDef, SessionHookDef } from "../types.js";

const execFileAsync = promisify(execFile);

export class HookRunner {
  constructor(private projectRoot: string) {}

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

      const ctx: HookContext = {
        session_id: "unknown",
        cwd: this.projectRoot,
        hook_event: "hook",
        tool_name: triggeredByTool,
      };

      const scriptPath = resolve(this.projectRoot, hook.script);
      const hookName = hook.name ?? basename(hook.script, ".sh");

      if (!existsSync(scriptPath) && hook.blocking) {
        const errResult: HookResult = {
          name: hookName,
          exitCode: 1,
          stdout: "",
          stderr: `Blocking hook "${hookName}" script not found: ${hook.script}`,
          durationMs: 0,
          passed: false,
        };
        results.push(errResult);
        throw new HookFailedError(hookName, errResult.stderr);
      }

      const result = await this.runScriptHook(hook.script, hook.name, hook.timeout ?? 30, ctx);
      results.push(result);

      if (hook.blocking && !result.passed) {
        throw new HookFailedError(result.name, result.stderr || result.stdout);
      }
    }

    return results;
  }

  async runTypedHooks(
    hooks: (HookDef | SessionHookDef)[],
    ctx: HookContext,
    triggeredByTool?: string
  ): Promise<HookResult[]> {
    const results: HookResult[] = [];

    for (const hook of hooks) {
      const onTools = "on_tools" in hook ? hook.on_tools : undefined;
      const matchesTool =
        !triggeredByTool || !onTools || onTools.includes(triggeredByTool);
      if (!matchesTool) continue;

      const result = await this.dispatchHook(hook, ctx);
      results.push(result);

      if (hook.blocking && !result.passed && !result.forceContinue) {
        throw new HookFailedError(result.name, result.stderr || result.stdout);
      }
    }

    return results;
  }

  async runPreToolHooks(
    hooks: HookDef[],
    ctx: HookContext
  ): Promise<{ results: HookResult[]; modifiedArgs?: Record<string, unknown> }> {
    const results: HookResult[] = [];
    let modifiedArgs: Record<string, unknown> | undefined;

    for (const hook of hooks) {
      const matchesTool =
        !ctx.tool_name || !hook.on_tools || hook.on_tools.includes(ctx.tool_name);
      if (!matchesTool) continue;

      const result = await this.dispatchHook(hook, ctx);
      results.push(result);

      if (result.modifiedArgs) {
        modifiedArgs = { ...(modifiedArgs ?? {}), ...result.modifiedArgs };
      }

      if (hook.blocking && !result.passed) {
        throw new HookFailedError(result.name, result.stderr || result.stdout);
      }
    }

    return { results, modifiedArgs };
  }

  async runStopHooks(
    hooks: SessionHookDef[],
    ctx: HookContext
  ): Promise<{ shouldContinue: boolean; results: HookResult[] }> {
    const results: HookResult[] = [];
    let shouldContinue = false;

    for (const hook of hooks) {
      const result = await this.dispatchHook(hook, ctx);
      results.push(result);
      if (result.forceContinue) {
        shouldContinue = true;
      }
    }

    return { shouldContinue, results };
  }

  private async dispatchHook(
    hook: HookDef | SessionHookDef,
    ctx: HookContext
  ): Promise<HookResult> {
    const hookName = hook.name ?? "hook";
    const timeout = hook.timeout ?? 30;
    const handler = hook.handler ?? "script";

    if (handler === "prompt") {
      if (!hook.evaluation_prompt) {
        return skipResult(hookName, "prompt handler missing evaluation_prompt");
      }
      return this.runPromptHook(hook.evaluation_prompt, hook.model, ctx, hookName, timeout);
    }

    if (handler === "agent") {
      if (!hook.agent_task) {
        return skipResult(hookName, "agent handler missing agent_task");
      }
      const allowedTools = "allowed_tools" in hook ? hook.allowed_tools : ["Read", "Grep", "Glob"];
      return this.runAgentHook(hook.agent_task, allowedTools, ctx, hookName, timeout);
    }

    const script = hook.script;
    if (!script) {
      return skipResult(hookName, "script handler missing script path");
    }
    const modifyInput = "modify_input" in hook ? hook.modify_input : false;
    return this.runScriptHook(script, hookName, timeout, ctx, modifyInput);
  }

  private async runScriptHook(
    script: string,
    name: string | undefined,
    timeout: number,
    ctx: HookContext,
    modifyInput = false
  ): Promise<HookResult> {
    const scriptPath = resolve(this.projectRoot, script);
    const hookName = name ?? basename(script, ".sh");
    const startMs = Date.now();

    if (!existsSync(scriptPath)) {
      return {
        name: hookName,
        exitCode: 0,
        stdout: `[Hook skipped: ${script} not found]`,
        stderr: "",
        durationMs: 0,
        passed: true,
      };
    }

    const stdinJson = JSON.stringify(ctx);

    return new Promise((res) => {
      const child = spawn("sh", [scriptPath], {
        cwd: this.projectRoot,
        timeout: timeout * 1000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.stdin.write(stdinJson);
      child.stdin.end();

      child.on("close", (code: number | null) => {
        const exitCode = code ?? 1;
        const durationMs = Date.now() - startMs;

        if (exitCode === 2) {
          res({ name: hookName, exitCode: 2, stdout, stderr, durationMs, passed: false, forceContinue: true });
          return;
        }

        let modifiedArgs: Record<string, unknown> | undefined;
        if (modifyInput && exitCode === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim()) as { modified_args?: Record<string, unknown> };
            if (parsed.modified_args) modifiedArgs = parsed.modified_args;
          } catch {
          }
        }

        res({ name: hookName, exitCode, stdout, stderr, durationMs, passed: exitCode === 0, modifiedArgs });
      });

      child.on("error", (err: Error) => {
        res({ name: hookName, exitCode: 1, stdout: "", stderr: err.message, durationMs: Date.now() - startMs, passed: false });
      });
    });
  }

  private async runPromptHook(
    evaluationPrompt: string,
    model: string | undefined,
    ctx: HookContext,
    hookName: string,
    timeout: number
  ): Promise<HookResult> {
    const startMs = Date.now();
    const fullPrompt = [
      evaluationPrompt,
      "",
      "Context:",
      JSON.stringify(ctx, null, 2),
      "",
      "Respond with exactly PASS or FAIL on the first line, then optionally explain.",
    ].join("\n");

    try {
      const { stdout } = await execFileAsync(
        "claude",
        ["--model", model ?? "claude-haiku-4-5", "--print", "--no-markdown", fullPrompt],
        { timeout: timeout * 1000, cwd: this.projectRoot }
      );
      const firstLine = stdout.trim().split("\n")[0].toUpperCase();
      const passed = firstLine.startsWith("PASS");
      return { name: hookName, exitCode: passed ? 0 : 1, stdout, stderr: "", durationMs: Date.now() - startMs, passed };
    } catch {
      return skipResult(hookName, "prompt handler: claude CLI not available, skipping");
    }
  }

  private async runAgentHook(
    agentTask: string,
    allowedTools: string[],
    ctx: HookContext,
    hookName: string,
    timeout: number
  ): Promise<HookResult> {
    const startMs = Date.now();
    const fullTask = [
      agentTask,
      "",
      `Working directory: ${ctx.cwd}`,
      ctx.tool_name ? `Triggered by tool: ${ctx.tool_name}` : "",
    ].filter(Boolean).join("\n");

    try {
      const { stdout } = await execFileAsync(
        "claude",
        ["--model", "claude-haiku-4-5", "--allowedTools", allowedTools.join(","), "--print", "--no-markdown", fullTask],
        { timeout: timeout * 1000, cwd: this.projectRoot }
      );
      const output = stdout.toLowerCase();
      const passed = !output.includes("fail") && !output.includes("❌");
      return { name: hookName, exitCode: passed ? 0 : 1, stdout, stderr: "", durationMs: Date.now() - startMs, passed };
    } catch {
      return skipResult(hookName, "agent handler: claude CLI not available, skipping");
    }
  }
}

function skipResult(name: string, reason: string): HookResult {
  return { name, exitCode: 0, stdout: `[${reason}]`, stderr: "", durationMs: 0, passed: true };
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
