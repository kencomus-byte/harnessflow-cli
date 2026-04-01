import { appendFileSync, existsSync } from "fs";
import { resolve } from "path";
import { TraceEvent, HarnessConfig, TokenUsage } from "../types.js";
import { ensureDir, formatTimestamp } from "../utils.js";

export class Tracer {
  private traceFile: string;

  constructor(
    private projectRoot: string,
    private config: HarnessConfig,
    private sessionId: string
  ) {
    const traceDir = resolve(projectRoot, config.observability.trace_dir);
    ensureDir(traceDir);
    this.traceFile = resolve(traceDir, `${sessionId}.jsonl`);
  }

  log(event: Omit<TraceEvent, "ts">): void {
    const entry: Record<string, unknown> = {
      ts: formatTimestamp(),
      ...event,
    };

    try {
      appendFileSync(this.traceFile, JSON.stringify(entry) + "\n", "utf8");
    } catch {
    }
  }

  logSessionStart(task: string, backend: string): void {
    this.log({ type: "session_start", sessionId: this.sessionId, task, backend });
  }

  logContextLoad(files: string[], tokens: number): void {
    this.log({ type: "context_load", files, tokens });
  }

  logToolCall(tool: string, args: Record<string, unknown>, success: boolean, latencyMs: number): void {
    this.log({ type: "tool_call", tool, args, success, latencyMs });
  }

  logHookRun(hook: string, trigger: string, exitCode: number, durationMs: number, error?: string): void {
    this.log({ type: "hook_run", hook, trigger, exitCode, durationMs, ...(error ? { error } : {}) });
  }

  logGuardrailBlock(pattern: string, action: string, userChoice?: string): void {
    this.log({ type: "guardrail_block", pattern, action, ...(userChoice ? { userChoice } : {}) });
  }

  logTokenUsage(usage: TokenUsage): void {
    this.log({ type: "token_usage", ...usage });
  }

  logSessionEnd(status: string, totalTokens: number, filesChanged: number): void {
    this.log({ type: "session_end", status, totalTokens, filesChanged });
  }

  logToTokenFile(sessionId: string, usage: TokenUsage): void {
    const tokenLogFile = resolve(
      this.projectRoot,
      this.config.observability.token_log
    );

    ensureDir(resolve(this.projectRoot, ".harness"));

    const entry = {
      ts: formatTimestamp(),
      sessionId,
      ...usage,
    };

    try {
      appendFileSync(tokenLogFile, JSON.stringify(entry) + "\n", "utf8");
    } catch {
    }
  }

  getTraceFile(): string {
    return this.traceFile;
  }

  traceFileExists(): boolean {
    return existsSync(this.traceFile);
  }
}
