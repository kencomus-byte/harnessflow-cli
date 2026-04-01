import { z } from "zod";

export const HarnessConfigSchema = z.object({
  backend: z.enum(["claude", "codex", "dry-run"]).default("claude"),
  model: z.string().optional(),

  context: z
    .object({
      project_file: z.string().default("CLAUDE.md"),
      feature_list: z.string().default(".harness/feature_list.md"),
      session_state: z.string().default(".harness/session.json"),
      handoff: z.string().default(".harness/handoff.md"),
      additional_dirs: z.array(z.string()).default([]),
    })
    .default({}),

  token_budget: z
    .object({
      max_context: z.number().default(150000),
      reserve_for_output: z.number().default(8000),
      warning_threshold: z.number().default(0.85),
    })
    .default({}),

  guardrails: z
    .object({
      mode: z.enum(["strict", "normal", "permissive"]).default("normal"),
      allowed_tools: z
        .array(z.string())
        .default(["Read", "Write", "Edit", "Bash", "Glob", "Grep"]),
      confirm_destructive: z.boolean().default(true),
      blocked_patterns: z
        .array(z.string())
        .default(["rm -rf", "DROP TABLE", "DROP DATABASE", "git push --force"]),
      injection_detection: z.boolean().default(true),
    })
    .default({}),

  hooks: z
    .object({
      pre_tool: z
        .array(
          z.object({
            name: z.string(),
            script: z.string(),
            on_tools: z.array(z.string()).optional(),
            timeout: z.number().default(30),
          })
        )
        .default([]),
      post_tool: z
        .array(
          z.object({
            name: z.string(),
            script: z.string(),
            on_tools: z.array(z.string()).optional(),
            blocking: z.boolean().default(false),
            timeout: z.number().default(60),
          })
        )
        .default([]),
      on_session_end: z
        .array(
          z.object({
            name: z.string(),
            script: z.string(),
            blocking: z.boolean().default(false),
          })
        )
        .default([]),
    })
    .default({}),

  session: z
    .object({
      checkpoint_every: z.number().default(5),
      auto_handoff: z.boolean().default(true),
      max_history: z.number().default(50),
    })
    .default({}),

  observability: z
    .object({
      trace_dir: z.string().default(".harness/traces"),
      eval_dir: z.string().default(".harness/evals"),
      token_log: z.string().default(".harness/token_usage.jsonl"),
      trace_format: z.enum(["jsonl", "json"]).default("jsonl"),
      auto_eval: z.boolean().default(true),
    })
    .default({}),
});

export type HarnessConfig = z.infer<typeof HarnessConfigSchema>;

export const SessionStateSchema = z.object({
  sessionId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  backend: z.string(),
  model: z.string().optional(),
  task: z.string(),
  status: z.enum(["RUNNING", "COMPLETED", "FAILED", "INTERRUPTED"]),
  progress: z
    .object({
      filesChanged: z.array(z.string()).default([]),
      testsAdded: z.number().default(0),
      testsPassing: z.number().default(0),
      testsFailing: z.number().default(0),
    })
    .default({}),
  tokenUsage: z
    .object({
      inputTokens: z.number().default(0),
      outputTokens: z.number().default(0),
      totalTokens: z.number().default(0),
      estimatedCost: z.number().default(0),
    })
    .default({}),
  nextSession: z
    .object({
      suggestedTask: z.string().optional(),
      blockers: z.array(z.string()).default([]),
      criticalFiles: z.array(z.string()).default([]),
    })
    .default({}),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

export interface AgentRequest {
  task: string;
  systemPrompt: string;
  context: string;
  allowedTools: string[];
  model?: string;
  sessionId?: string;
}

export type AgentEvent =
  | { type: "thinking"; content: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; result: string }
  | { type: "message"; content: string }
  | { type: "error"; error: string }
  | { type: "done"; usage: TokenUsage };

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ContextBundle {
  projectInstructions: string;
  sessionSummary: string;
  featureList: string;
  handoff: string;
  totalTokensEstimate: number;
}

export interface HookConfig {
  name: string;
  script: string;
  on_tools?: string[];
  blocking?: boolean;
  timeout?: number;
}

export interface HookResult {
  name: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
}

export type TraceEvent = {
  ts: string;
  type: string;
} & Record<string, unknown>;
