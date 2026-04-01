import { Router } from "express";
import {
  addSession,
  updateSession,
  getSession,
} from "../lib/session-store";
import {
  startHarnessCommand,
  killProcess,
  subscribeToExecution,
  getExecIdForSession,
  getExecution,
} from "../lib/process-manager";
import { logger } from "../lib/logger";
import type { Session } from "../data/harness-types";

const router = Router();

// POST /api/sessions/start — launch a new harness session
router.post("/sessions/start", (req, res) => {
  const { backend = "dry-run", model, task } = req.body as {
    backend?: string;
    model?: string;
    task?: string;
  };

  if (!task || !task.trim()) {
    res.status(400).json({ error: "task is required" });
    return;
  }

  const ts = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 15);
  const sessionId = `sess_${ts}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const session: Session = {
    sessionId,
    startedAt: now,
    endedAt: null,
    backend,
    model: model ?? null,
    task: task.trim(),
    status: "RUNNING",
    durationMs: null,
    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    progress: { filesChanged: [], testsAdded: 0, testsPassing: 0 },
    guardrailBlocks: 0,
    toolCallCount: 0,
  };

  addSession(session);

  // Task is a positional argument: harness run <task> --backend <backend>
  const args: string[] = ["run", task.trim(), "--backend", backend];
  if (model) args.push("--model", model);

  logger.info({ sessionId, backend, model, task: task.trim() }, "Starting harness session");

  const startedAt = Date.now();
  const execId = startHarnessCommand(args, sessionId);

  // Poll until process finishes and update session status
  const checkDone = () => {
    const exec = getExecution(execId);
    if (!exec) return;
    if (exec.done) {
      const durationMs = Date.now() - startedAt;
      updateSession(sessionId, {
        status: exec.exitCode === 0 ? "COMPLETED" : "FAILED",
        endedAt: new Date().toISOString(),
        durationMs,
      });
      logger.info({ sessionId, exitCode: exec.exitCode, durationMs }, "Session finished");
    } else {
      setTimeout(checkDone, 500);
    }
  };
  setTimeout(checkDone, 500);

  res.json({ sessionId, execId, status: "RUNNING" });
});

// PATCH /api/sessions/:id/stop — stop a running session
router.patch("/sessions/:sessionId/stop", (req, res) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status !== "RUNNING") {
    res.status(400).json({ error: `Session is not running (status: ${session.status})` });
    return;
  }

  const killed = killProcess(sessionId);
  updateSession(sessionId, {
    status: "INTERRUPTED",
    endedAt: new Date().toISOString(),
    durationMs: session.startedAt
      ? Date.now() - new Date(session.startedAt).getTime()
      : null,
  });

  logger.info({ sessionId, killed }, "Session stopped");
  res.json({ sessionId, status: "INTERRUPTED", killed });
});

// GET /api/terminal/events/:execId — SSE stream for a running execution
router.get("/terminal/events/:execId", (req, res) => {
  const { execId } = req.params;
  const found = subscribeToExecution(execId, res);
  if (!found) {
    res.status(404).json({ error: "Execution not found" });
  }
});

// POST /api/terminal/exec — run an arbitrary harness command from the terminal
router.post("/terminal/exec", (req, res) => {
  const { command } = req.body as { command?: string };

  if (!command || !command.trim()) {
    res.status(400).json({ error: "command is required" });
    return;
  }

  const trimmed = command.trim();
  // Strip leading "harness " prefix if present
  const remainder = trimmed.startsWith("harness ") ? trimmed.slice(8) : trimmed;
  // Also handle bare "harness" (no subcommand)
  if (remainder === "harness" || remainder === "") {
    res.status(400).json({ error: "Please specify a subcommand (run, status, check, eval, ...)" });
    return;
  }

  // Shell-like arg splitting (handles quoted strings)
  const parts = shellSplit(remainder);
  const sub = parts[0];

  const ALLOWED = ["run", "status", "check", "eval", "replay", "generate-claude", "spawn", "plugin", "--version", "--help"];
  if (!ALLOWED.includes(sub)) {
    res.status(400).json({
      error: `Unknown subcommand: '${sub}'. Available: ${ALLOWED.filter(c => !c.startsWith("--")).join(", ")}`,
    });
    return;
  }

  logger.info({ command: trimmed, parts }, "Terminal exec");
  const execId = startHarnessCommand(parts);
  res.json({ execId, command: trimmed });
});

// GET /api/sessions/:id/exec-id — get the active execId for a session (for live streaming)
router.get("/sessions/:sessionId/exec-id", (req, res) => {
  const execId = getExecIdForSession(req.params.sessionId);
  if (!execId) {
    res.status(404).json({ error: "No active execution for this session" });
    return;
  }
  res.json({ execId });
});

// Simple shell-like arg splitting that handles double-quoted strings
function shellSplit(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && !inQuote) {
      inQuote = true;
    } else if (ch === '"' && inQuote) {
      inQuote = false;
    } else if (ch === " " && !inQuote) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

export default router;
