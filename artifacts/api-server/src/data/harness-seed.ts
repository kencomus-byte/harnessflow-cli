import type {
  Session,
  TraceEvent,
  EvalReport,
  AnalyticsSummary,
  TokenUsagePoint,
  ToolStat,
  ActivityEvent,
  HarnessConfig,
} from "./harness-types";

function daysAgo(d: number, hour = 12): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
}

function minutesAfter(base: string, mins: number): string {
  const dt = new Date(base);
  dt.setMinutes(dt.getMinutes() + mins);
  return dt.toISOString();
}

export const SESSIONS: Session[] = [
  {
    sessionId: "sess_20260401_090012",
    startedAt: daysAgo(0, 9),
    endedAt: minutesAfter(daysAgo(0, 9), 23),
    backend: "claude",
    model: "claude-opus-4-5",
    task: "Refactor authentication module to use JWT refresh tokens and add rate limiting middleware",
    status: "COMPLETED",
    durationMs: 23 * 60 * 1000,
    tokenUsage: { inputTokens: 48200, outputTokens: 12300, totalTokens: 60500, estimatedCostUsd: 1.89 },
    progress: { filesChanged: ["src/auth/jwt.ts", "src/auth/refresh.ts", "src/middleware/rate-limit.ts", "src/auth/index.ts"], testsAdded: 8, testsPassing: 8 },
    guardrailBlocks: 0,
    toolCallCount: 34,
  },
  {
    sessionId: "sess_20260401_061530",
    startedAt: daysAgo(0, 6),
    endedAt: null,
    backend: "claude",
    model: "claude-opus-4-5",
    task: "Build real-time WebSocket notification system with Redis pub/sub and reconnection logic",
    status: "RUNNING",
    durationMs: null,
    tokenUsage: { inputTokens: 31400, outputTokens: 8900, totalTokens: 40300, estimatedCostUsd: 1.26 },
    progress: { filesChanged: ["src/ws/server.ts", "src/ws/client.ts", "src/pubsub/redis.ts"], testsAdded: 3, testsPassing: 3 },
    guardrailBlocks: 1,
    toolCallCount: 22,
  },
  {
    sessionId: "sess_20260331_142210",
    startedAt: daysAgo(1, 14),
    endedAt: minutesAfter(daysAgo(1, 14), 41),
    backend: "codex",
    model: "o3",
    task: "Migrate database from SQLite to PostgreSQL with zero-downtime migration scripts",
    status: "COMPLETED",
    durationMs: 41 * 60 * 1000,
    tokenUsage: { inputTokens: 72100, outputTokens: 19800, totalTokens: 91900, estimatedCostUsd: 2.76 },
    progress: { filesChanged: ["migrations/001_pg.sql", "migrations/002_indexes.sql", "src/db/client.ts", "src/db/pool.ts", "scripts/migrate.ts"], testsAdded: 12, testsPassing: 12 },
    guardrailBlocks: 0,
    toolCallCount: 58,
  },
  {
    sessionId: "sess_20260331_093045",
    startedAt: daysAgo(1, 9),
    endedAt: minutesAfter(daysAgo(1, 9), 7),
    backend: "claude",
    model: "claude-opus-4-5",
    task: "Add OpenTelemetry tracing to API gateway — instrument all route handlers and DB queries",
    status: "FAILED",
    durationMs: 7 * 60 * 1000,
    tokenUsage: { inputTokens: 15300, outputTokens: 3200, totalTokens: 18500, estimatedCostUsd: 0.58 },
    progress: { filesChanged: ["src/telemetry/tracer.ts"], testsAdded: 0, testsPassing: 0 },
    guardrailBlocks: 2,
    toolCallCount: 11,
  },
  {
    sessionId: "sess_20260330_161800",
    startedAt: daysAgo(2, 16),
    endedAt: minutesAfter(daysAgo(2, 16), 55),
    backend: "claude",
    model: "claude-opus-4-5",
    task: "Implement full-text search using Elasticsearch with fuzzy matching and result highlighting",
    status: "COMPLETED",
    durationMs: 55 * 60 * 1000,
    tokenUsage: { inputTokens: 89400, outputTokens: 24100, totalTokens: 113500, estimatedCostUsd: 3.52 },
    progress: { filesChanged: ["src/search/elastic.ts", "src/search/index.ts", "src/routes/search.ts", "src/types/search.ts", "tests/search.test.ts"], testsAdded: 15, testsPassing: 15 },
    guardrailBlocks: 0,
    toolCallCount: 71,
  },
  {
    sessionId: "sess_20260330_110022",
    startedAt: daysAgo(2, 11),
    endedAt: minutesAfter(daysAgo(2, 11), 19),
    backend: "codex",
    model: "o3",
    task: "Fix memory leak in request queue processor — objects not being released after timeout",
    status: "COMPLETED",
    durationMs: 19 * 60 * 1000,
    tokenUsage: { inputTokens: 22600, outputTokens: 5400, totalTokens: 28000, estimatedCostUsd: 0.84 },
    progress: { filesChanged: ["src/queue/processor.ts", "src/queue/cleanup.ts"], testsAdded: 4, testsPassing: 4 },
    guardrailBlocks: 0,
    toolCallCount: 18,
  },
  {
    sessionId: "sess_20260329_143300",
    startedAt: daysAgo(3, 14),
    endedAt: minutesAfter(daysAgo(3, 14), 13),
    backend: "claude",
    model: "claude-haiku-3-5",
    task: "Generate TypeScript types from OpenAPI spec and update API client bindings",
    status: "INTERRUPTED",
    durationMs: 13 * 60 * 1000,
    tokenUsage: { inputTokens: 11200, outputTokens: 2800, totalTokens: 14000, estimatedCostUsd: 0.44 },
    progress: { filesChanged: ["src/types/api.ts"], testsAdded: 0, testsPassing: 0 },
    guardrailBlocks: 3,
    toolCallCount: 9,
  },
  {
    sessionId: "sess_20260328_090000",
    startedAt: daysAgo(4, 9),
    endedAt: minutesAfter(daysAgo(4, 9), 62),
    backend: "claude",
    model: "claude-opus-4-5",
    task: "Implement CQRS pattern for order management system with event sourcing",
    status: "COMPLETED",
    durationMs: 62 * 60 * 1000,
    tokenUsage: { inputTokens: 104500, outputTokens: 31200, totalTokens: 135700, estimatedCostUsd: 4.21 },
    progress: { filesChanged: ["src/cqrs/commands.ts", "src/cqrs/queries.ts", "src/events/store.ts", "src/events/replay.ts", "src/orders/handler.ts", "src/orders/projector.ts"], testsAdded: 24, testsPassing: 24 },
    guardrailBlocks: 0,
    toolCallCount: 88,
  },
];

export const TRACE_EVENTS: Record<string, TraceEvent[]> = {
  "sess_20260401_090012": [
    { ts: daysAgo(0, 9), type: "session_start", message: "Session initialized with backend=claude model=claude-opus-4-5" },
    { ts: minutesAfter(daysAgo(0, 9), 0), type: "hook_run", hookEvent: "on_session_start", hookName: "notify-slack", exitCode: 0 },
    { ts: minutesAfter(daysAgo(0, 9), 1), type: "tool_call", tool: "read_file", input: { path: "src/auth/index.ts" }, output: "export * from './jwt'; export * from './session';", durationMs: 43 },
    { ts: minutesAfter(daysAgo(0, 9), 2), type: "tool_call", tool: "read_file", input: { path: "src/auth/jwt.ts" }, output: "// JWT utilities...", durationMs: 31 },
    { ts: minutesAfter(daysAgo(0, 9), 3), type: "tool_call", tool: "write_file", input: { path: "src/auth/jwt.ts" }, output: "Written 245 bytes", durationMs: 67 },
    { ts: minutesAfter(daysAgo(0, 9), 5), type: "tool_call", tool: "write_file", input: { path: "src/auth/refresh.ts" }, output: "Written 312 bytes", durationMs: 55 },
    { ts: minutesAfter(daysAgo(0, 9), 7), type: "tool_call", tool: "bash", input: { command: "npm test src/auth" }, output: "8 tests passed", durationMs: 4200 },
    { ts: minutesAfter(daysAgo(0, 9), 9), type: "hook_run", hookEvent: "post_tool", hookName: "typecheck", exitCode: 0 },
    { ts: minutesAfter(daysAgo(0, 9), 12), type: "tool_call", tool: "write_file", input: { path: "src/middleware/rate-limit.ts" }, output: "Written 189 bytes", durationMs: 48 },
    { ts: minutesAfter(daysAgo(0, 9), 18), type: "tool_call", tool: "bash", input: { command: "npm run typecheck" }, output: "0 errors", durationMs: 3100 },
    { ts: minutesAfter(daysAgo(0, 9), 20), type: "hook_run", hookEvent: "on_stop", hookName: "quality-gate", exitCode: 0 },
    { ts: minutesAfter(daysAgo(0, 9), 22), type: "session_end", message: "Session completed successfully" },
  ],
  "sess_20260331_093045": [
    { ts: daysAgo(1, 9), type: "session_start", message: "Session initialized with backend=claude model=claude-opus-4-5" },
    { ts: minutesAfter(daysAgo(1, 9), 1), type: "tool_call", tool: "read_file", input: { path: "src/app.ts" }, durationMs: 28 },
    { ts: minutesAfter(daysAgo(1, 9), 2), type: "guardrail_block", tool: "bash", blocked: true, reason: "Command 'curl http://localhost:3000' blocked — external network calls disallowed in guardrail mode" },
    { ts: minutesAfter(daysAgo(1, 9), 3), type: "tool_call", tool: "write_file", input: { path: "src/telemetry/tracer.ts" }, durationMs: 71 },
    { ts: minutesAfter(daysAgo(1, 9), 5), type: "guardrail_block", tool: "bash", blocked: true, reason: "Command 'npm install @opentelemetry/sdk-node' blocked — package installation disallowed" },
    { ts: minutesAfter(daysAgo(1, 9), 6), type: "session_end", message: "Session failed — guardrail policy prevented required operations" },
  ],
};

export const EVAL_REPORTS: Record<string, EvalReport> = {
  "sess_20260401_090012": {
    sessionId: "sess_20260401_090012",
    status: "PASS",
    tokenUsage: { inputTokens: 48200, outputTokens: 12300, totalTokens: 60500, estimatedCostUsd: 1.89 },
    toolCallCount: 34,
    filesChanged: ["src/auth/jwt.ts", "src/auth/refresh.ts", "src/middleware/rate-limit.ts", "src/auth/index.ts"],
    guardrailBlocks: 0,
    durationMs: 23 * 60 * 1000,
    qualityGates: [
      { name: "typecheck", passed: true, exitCode: 0, output: "0 errors", durationMs: 3100 },
      { name: "test", passed: true, exitCode: 0, output: "8 tests passed", durationMs: 4200 },
      { name: "lint", passed: true, exitCode: 0, output: "No lint errors", durationMs: 890 },
    ],
    notes: "All quality gates passed. Refresh token implementation follows RFC 6750.",
  },
  "sess_20260331_142210": {
    sessionId: "sess_20260331_142210",
    status: "PASS",
    tokenUsage: { inputTokens: 72100, outputTokens: 19800, totalTokens: 91900, estimatedCostUsd: 2.76 },
    toolCallCount: 58,
    filesChanged: ["migrations/001_pg.sql", "migrations/002_indexes.sql", "src/db/client.ts", "src/db/pool.ts", "scripts/migrate.ts"],
    guardrailBlocks: 0,
    durationMs: 41 * 60 * 1000,
    qualityGates: [
      { name: "typecheck", passed: true, exitCode: 0, output: "0 errors", durationMs: 2800 },
      { name: "test", passed: true, exitCode: 0, output: "12 tests passed", durationMs: 8900 },
      { name: "migration-dry-run", passed: true, exitCode: 0, output: "Migration plan OK", durationMs: 1200 },
    ],
  },
  "sess_20260331_093045": {
    sessionId: "sess_20260331_093045",
    status: "FAIL",
    tokenUsage: { inputTokens: 15300, outputTokens: 3200, totalTokens: 18500, estimatedCostUsd: 0.58 },
    toolCallCount: 11,
    filesChanged: ["src/telemetry/tracer.ts"],
    guardrailBlocks: 2,
    durationMs: 7 * 60 * 1000,
    qualityGates: [
      { name: "typecheck", passed: false, exitCode: 1, output: "3 errors in src/telemetry/tracer.ts", durationMs: 2100 },
      { name: "test", passed: false, exitCode: 1, output: "0 tests run — compilation failed", durationMs: 500 },
    ],
    notes: "Session failed because guardrail policy blocked package installation. Tracer stub is incomplete.",
  },
};

export function buildAnalyticsSummary(): AnalyticsSummary {
  const total = SESSIONS.length;
  const completed = SESSIONS.filter(s => s.status === "COMPLETED").length;
  const failed = SESSIONS.filter(s => s.status === "FAILED").length;
  const running = SESSIONS.filter(s => s.status === "RUNNING").length;
  const totalTokens = SESSIONS.reduce((s, x) => s + x.tokenUsage.totalTokens, 0);
  const totalCost = SESSIONS.reduce((s, x) => s + x.tokenUsage.estimatedCostUsd, 0);
  const durations = SESSIONS.filter(s => s.durationMs).map(s => s.durationMs!);
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const successRate = total ? completed / total : 0;
  const totalTools = SESSIONS.reduce((s, x) => s + x.toolCallCount, 0);
  const totalBlocks = SESSIONS.reduce((s, x) => s + x.guardrailBlocks, 0);
  const backends: Record<string, number> = {};
  SESSIONS.forEach(s => { backends[s.backend] = (backends[s.backend] || 0) + 1; });
  const topBackend = Object.entries(backends).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { totalSessions: total, completedSessions: completed, failedSessions: failed, runningSessions: running, totalTokens, totalCostUsd: Math.round(totalCost * 100) / 100, avgDurationMs: Math.round(avgDuration), successRate: Math.round(successRate * 1000) / 1000, totalToolCalls: totalTools, totalGuardrailBlocks: totalBlocks, topBackend };
}

export function buildTokenTimeline(days: number): TokenUsagePoint[] {
  const result: TokenUsagePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const dateStr = dt.toISOString().split("T")[0];
    const dayOffset = days - 1 - i;
    const base = Math.max(0, 40000 - dayOffset * 2000 + Math.sin(dayOffset * 0.7) * 15000);
    const inputTokens = Math.round(base * 0.78 + Math.random() * 5000);
    const outputTokens = Math.round(base * 0.22 + Math.random() * 1500);
    const totalTokens = inputTokens + outputTokens;
    const sessionCount = Math.max(0, Math.round(1.5 + Math.sin(dayOffset * 0.4) * 1.2 + Math.random() * 0.8));
    result.push({ date: dateStr, inputTokens, outputTokens, totalTokens, costUsd: Math.round(totalTokens * 0.0000315 * 100) / 100, sessionCount });
  }
  return result;
}

export const TOOL_STATS: ToolStat[] = [
  { tool: "read_file", callCount: 142, successCount: 142, failCount: 0, avgDurationMs: 38 },
  { tool: "write_file", callCount: 98, successCount: 97, failCount: 1, avgDurationMs: 61 },
  { tool: "bash", callCount: 74, successCount: 68, failCount: 6, avgDurationMs: 3840 },
  { tool: "list_files", callCount: 55, successCount: 55, failCount: 0, avgDurationMs: 22 },
  { tool: "search_files", callCount: 41, successCount: 41, failCount: 0, avgDurationMs: 145 },
  { tool: "edit_file", callCount: 38, successCount: 36, failCount: 2, avgDurationMs: 89 },
  { tool: "read_url", callCount: 12, successCount: 10, failCount: 2, avgDurationMs: 620 },
  { tool: "run_tests", callCount: 28, successCount: 24, failCount: 4, avgDurationMs: 5200 },
];

export function buildActivityFeed(limit: number): ActivityEvent[] {
  const events: ActivityEvent[] = SESSIONS.flatMap(s => {
    const evts: ActivityEvent[] = [
      { ts: s.startedAt, sessionId: s.sessionId, type: "session_start", description: `Started: ${s.task.slice(0, 70)}${s.task.length > 70 ? "…" : ""}`, backend: s.backend, status: s.status },
    ];
    if (s.endedAt) {
      evts.push({ ts: s.endedAt, sessionId: s.sessionId, type: s.status === "COMPLETED" ? "session_complete" : s.status === "FAILED" ? "session_failed" : "session_interrupted", description: s.status === "COMPLETED" ? `Completed — ${s.tokenUsage.totalTokens.toLocaleString()} tokens, $${s.tokenUsage.estimatedCostUsd.toFixed(2)}` : `${s.status} after ${s.durationMs ? Math.round(s.durationMs / 60000) : "?"}m`, backend: s.backend, status: s.status });
    }
    if (s.guardrailBlocks > 0) {
      evts.push({ ts: minutesAfter(s.startedAt, 3), sessionId: s.sessionId, type: "guardrail_block", description: `${s.guardrailBlocks} guardrail block${s.guardrailBlocks > 1 ? "s" : ""} triggered`, backend: s.backend });
    }
    return evts;
  });
  return events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, limit);
}

export const HARNESS_CONFIG: HarnessConfig = {
  backend: "claude",
  model: "claude-opus-4-5",
  guardrails: {
    mode: "strict",
    blocked_patterns: ["rm -rf", "DROP TABLE", "curl -X DELETE"],
    allowed_tools: ["read_file", "write_file", "bash", "list_files", "search_files", "edit_file"],
  },
  hooks: {
    on_session_start: [{ name: "notify-slack", script: ".harness/hooks/slack-notify.sh" }],
    on_stop: [{ name: "quality-gate", script: ".harness/hooks/quality-gate.sh" }],
    post_tool: [{ name: "typecheck", script: ".harness/hooks/typecheck.sh", filter: { tools: ["write_file", "edit_file"] } }],
  },
  quality_gates: [
    { name: "typecheck", command: "npm run typecheck", timeout_ms: 30000 },
    { name: "test", command: "npm test", timeout_ms: 120000 },
    { name: "lint", command: "npm run lint", timeout_ms: 15000 },
  ],
  token_budget: { max_tokens: 200000, warn_at: 150000 },
  spawn: { max_agents: 3, timeout_ms: 300000 },
};

export type {
  Session,
  TraceEvent,
  EvalReport,
  AnalyticsSummary,
  TokenUsagePoint,
  ToolStat,
  ActivityEvent,
  HarnessConfig,
};
