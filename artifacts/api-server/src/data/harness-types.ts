export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface SessionProgress {
  filesChanged: string[];
  testsAdded: number;
  testsPassing: number;
}

export interface Session {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  backend: string;
  model?: string | null;
  task: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "INTERRUPTED";
  durationMs: number | null;
  tokenUsage: TokenUsage;
  progress: SessionProgress;
  guardrailBlocks: number;
  toolCallCount: number;
}

export interface TraceEvent {
  ts: string;
  type: string;
  tool?: string | null;
  input?: Record<string, unknown> | null;
  output?: string | null;
  blocked?: boolean | null;
  reason?: string | null;
  tokens?: number | null;
  durationMs?: number | null;
  hookEvent?: string | null;
  hookName?: string | null;
  exitCode?: number | null;
  message?: string | null;
}

export interface QualityGateResult {
  name: string;
  passed: boolean;
  exitCode: number;
  output?: string | null;
  durationMs?: number | null;
}

export interface EvalReport {
  sessionId: string;
  status: string;
  tokenUsage: TokenUsage;
  toolCallCount: number;
  filesChanged: string[];
  guardrailBlocks: number;
  durationMs: number;
  qualityGates: QualityGateResult[];
  notes?: string | null;
}

export interface AnalyticsSummary {
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  runningSessions: number;
  totalTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  successRate: number;
  totalToolCalls: number;
  totalGuardrailBlocks: number;
  topBackend: string | null;
}

export interface TokenUsagePoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  sessionCount: number;
}

export interface ToolStat {
  tool: string;
  callCount: number;
  successCount: number;
  failCount: number;
  avgDurationMs: number;
}

export interface ActivityEvent {
  ts: string;
  sessionId: string;
  type: string;
  description: string;
  backend?: string | null;
  status?: string | null;
}

export interface HarnessConfig {
  backend: string;
  model?: string | null;
  guardrails?: Record<string, unknown> | null;
  hooks?: Record<string, unknown> | null;
  quality_gates?: unknown[] | null;
  token_budget?: Record<string, unknown> | null;
  spawn?: Record<string, unknown> | null;
}
