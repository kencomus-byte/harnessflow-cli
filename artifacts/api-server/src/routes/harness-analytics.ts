import { Router } from "express";
import {
  buildTokenTimeline,
  TOOL_STATS,
} from "../data/harness-seed";
import { getSessions } from "../lib/session-store";
import type { AnalyticsSummary, ActivityEvent } from "../data/harness-types";

const router = Router();

router.get("/analytics/summary", (_req, res) => {
  const sessions = getSessions();
  const total = sessions.length;
  const completed = sessions.filter(s => s.status === "COMPLETED").length;
  const failed = sessions.filter(s => s.status === "FAILED").length;
  const running = sessions.filter(s => s.status === "RUNNING").length;
  const totalTokens = sessions.reduce((s, x) => s + x.tokenUsage.totalTokens, 0);
  const totalCost = sessions.reduce((s, x) => s + x.tokenUsage.estimatedCostUsd, 0);
  const durations = sessions.filter(s => s.durationMs).map(s => s.durationMs!);
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const successRate = total ? completed / total : 0;
  const totalTools = sessions.reduce((s, x) => s + x.toolCallCount, 0);
  const totalBlocks = sessions.reduce((s, x) => s + x.guardrailBlocks, 0);
  const backends: Record<string, number> = {};
  sessions.forEach(s => { backends[s.backend] = (backends[s.backend] || 0) + 1; });
  const topBackend = Object.entries(backends).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const summary: AnalyticsSummary = {
    totalSessions: total,
    completedSessions: completed,
    failedSessions: failed,
    runningSessions: running,
    totalTokens,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    avgDurationMs: Math.round(avgDuration),
    successRate: Math.round(successRate * 1000) / 1000,
    totalToolCalls: totalTools,
    totalGuardrailBlocks: totalBlocks,
    topBackend,
  };
  res.json(summary);
});

router.get("/analytics/tokens", (req, res) => {
  const days = parseInt((req.query as Record<string, string>).days ?? "30", 10);
  res.json(buildTokenTimeline(isNaN(days) || days < 1 ? 30 : Math.min(days, 90)));
});

router.get("/analytics/tools", (_req, res) => {
  res.json(TOOL_STATS);
});

router.get("/analytics/activity", (req, res) => {
  const limit = parseInt((req.query as Record<string, string>).limit ?? "20", 10);
  const safeLimit = isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100);

  const sessions = getSessions();
  const events: ActivityEvent[] = sessions.flatMap(s => {
    const evts: ActivityEvent[] = [
      { ts: s.startedAt, sessionId: s.sessionId, type: "session_start", description: `Started: ${s.task.slice(0, 70)}${s.task.length > 70 ? "…" : ""}`, backend: s.backend, status: s.status },
    ];
    if (s.endedAt) {
      const desc = s.status === "COMPLETED"
        ? `Completed — ${s.tokenUsage.totalTokens.toLocaleString()} tokens, $${s.tokenUsage.estimatedCostUsd.toFixed(2)}`
        : `${s.status} after ${s.durationMs ? Math.round(s.durationMs / 60000) : "?"}m`;
      evts.push({ ts: s.endedAt, sessionId: s.sessionId, type: s.status === "COMPLETED" ? "session_complete" : s.status === "FAILED" ? "session_failed" : "session_interrupted", description: desc, backend: s.backend, status: s.status });
    }
    if (s.guardrailBlocks > 0) {
      const guardTs = new Date(new Date(s.startedAt).getTime() + 3 * 60000).toISOString();
      evts.push({ ts: guardTs, sessionId: s.sessionId, type: "guardrail_block", description: `${s.guardrailBlocks} guardrail block${s.guardrailBlocks > 1 ? "s" : ""} triggered`, backend: s.backend });
    }
    return evts;
  });

  res.json(events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, safeLimit));
});

export default router;
