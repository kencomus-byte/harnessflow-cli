import { spawn, type ChildProcess } from "child_process";
import path from "path";
import type { Response } from "express";

// From artifacts/api-server → go up to workspace root, then into harness-flow
const HARNESS_CLI = path.resolve(process.cwd(), "../../artifacts/harness-flow/dist/index.cjs");

interface Execution {
  child: ChildProcess;
  output: Array<{ type: string; line: string; ts: string }>;
  done: boolean;
  exitCode: number | null;
  listeners: Set<Response>;
  sessionId?: string;
}

const executions = new Map<string, Execution>();
const sessionProcesses = new Map<string, string>(); // sessionId -> execId

export function startHarnessCommand(
  args: string[],
  sessionId?: string,
): string {
  const execId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const listeners = new Set<Response>();
  const output: Execution["output"] = [];

  const child = spawn("node", [HARNESS_CLI, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Close stdin immediately so CLI doesn't wait for input
  child.stdin?.end();

  const pushLine = (type: string, line: string) => {
    const entry = { type, line, ts: new Date().toISOString() };
    output.push(entry);
    for (const res of listeners) {
      try {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
      } catch {
        listeners.delete(res);
      }
    }
  };

  child.stdout?.on("data", (chunk: Buffer) => {
    chunk
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((l) => pushLine("stdout", stripAnsi(l)));
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    chunk
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((l) => pushLine("stderr", stripAnsi(l)));
  });

  child.on("close", (code) => {
    pushLine("system", `[Process exited with code ${code ?? 0}]`);
    const exec = executions.get(execId);
    if (exec) {
      exec.done = true;
      exec.exitCode = code ?? 0;
      for (const res of exec.listeners) {
        try {
          res.write(`data: ${JSON.stringify({ type: "done", code: code ?? 0 })}\n\n`);
          res.end();
        } catch { /* ignore */ }
      }
      exec.listeners.clear();
    }
    if (sessionId) sessionProcesses.delete(sessionId);
  });

  child.on("error", (err) => {
    pushLine("error", `[Spawn error: ${err.message}]`);
  });

  executions.set(execId, { child, output, done: false, exitCode: null, listeners, sessionId });
  if (sessionId) sessionProcesses.set(sessionId, execId);

  return execId;
}

export function subscribeToExecution(execId: string, res: Response): boolean {
  const exec = executions.get(execId);
  if (!exec) return false;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Replay buffered output
  for (const entry of exec.output) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  if (exec.done) {
    res.write(`data: ${JSON.stringify({ type: "done", code: exec.exitCode ?? 0 })}\n\n`);
    res.end();
    return true;
  }

  exec.listeners.add(res);
  res.on("close", () => exec.listeners.delete(res));
  return true;
}

export function killProcess(sessionId: string): boolean {
  const execId = sessionProcesses.get(sessionId);
  if (!execId) return false;
  const exec = executions.get(execId);
  if (!exec || exec.done) return false;
  exec.child.kill("SIGTERM");
  return true;
}

export function getExecIdForSession(sessionId: string): string | undefined {
  return sessionProcesses.get(sessionId);
}

export function getExecution(execId: string): Execution | undefined {
  return executions.get(execId);
}

// Strip ANSI escape codes from terminal output
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[mGKHF]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
}
