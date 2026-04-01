# HarnessFlow CLI

> A TypeScript harness layer between you and AI coding agents

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-81%20unit%20%2B%2066%20E2E-brightgreen.svg)](#tests)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

```
User → HarnessFlow CLI → Adapter → Claude CLI / Codex CLI
```

HarnessFlow wraps AI coding agents with everything they need to work reliably: session state, context delivery, guardrails, hooks, quality gates, observability, sub-agent orchestration, and plugins — **everything except the model itself**.

---

## Table of Contents

- [Why HarnessFlow](#why-harnessflow)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Quick Start](#quick-start)
- [Context Files](#context-files)
- [Commands](#commands)
- [Configuration Reference](#configuration-reference)
- [Guardrails](#guardrails)
- [Hook System](#hook-system)
- [Quality Gates](#quality-gates)
- [Sub-agent Orchestration](#sub-agent-orchestration)
- [Plugin System](#plugin-system)
- [Observability](#observability)
- [Session Lifecycle](#session-lifecycle)
- [Architecture](#architecture)
- [Recipes](#recipes)
- [Harness Engineering](#harness-engineering)
- [Tests](#tests)
- [Contributing](#contributing)
- [License](#license)

---

## Why HarnessFlow

Weak results from AI coding agents are usually **harness problems, not model problems**. The model has the intelligence — the harness makes that intelligence reliable.

Without a harness, agents:
- Lose context between sessions
- Call destructive commands without confirmation
- Drift from project conventions
- Produce no audit trail
- Repeat the same mistakes

HarnessFlow gives you deterministic control points around every agent interaction:

| Problem | HarnessFlow solution |
|---|---|
| Agent forgets context between runs | Session state + handoff artifacts |
| Agent drifts from conventions | CLAUDE.md + hooks that enforce on every tool call |
| `rm -rf` or `DROP TABLE` accidents | Guardrails with block/confirm/deny |
| No visibility into what the agent did | JSONL traces + eval reports |
| Prompt injection attacks | Injection detection + `on_user_prompt` hooks |
| Hard to coordinate multi-step work | `harness spawn` sub-agent orchestration |

---

## Prerequisites

| Dependency | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | Required |
| pnpm | ≥ 8 | For building from source |
| Claude CLI | any | Required for `--backend claude` |
| Codex CLI | any | Required for `--backend codex` |

> **Tip:** Use `--dry-run` or `--backend dry-run` to run HarnessFlow without any AI backend installed. All features except actual code generation work in dry-run mode.

---

## Install

**From source (recommended):**
```bash
git clone https://github.com/kencomus-byte/harnessflow-cli.git
cd harnessflow-cli/artifacts/harness-flow
pnpm install
node build.mjs
npm link          # makes `harness` available globally
```

**Verify:**
```bash
harness --version   # 0.2.0
harness --help
```

---

## Quick Start

```bash
# 1. Initialize HarnessFlow in your project root
cd my-project
harness init --backend claude

# 2. Edit CLAUDE.md to describe your project (keep it under 60 lines)
# Edit .harness/feature_list.md to describe current features

# 3. Run a task
harness run "Add rate limiting to the /api/auth endpoint"

# 4. Check what happened
harness status
harness eval

# 5. Next session — agent gets context from previous handoff
harness run "Write unit tests for the rate limiter"
```

After `harness init`, your project looks like this:
```
my-project/
├── .harness.yaml              ← main config
├── CLAUDE.md                  ← agent instructions (edit this!)
└── .harness/
    ├── session.json           ← last session state
    ├── feature_list.md        ← feature list for context
    ├── handoff.md             ← generated after each session
    ├── traces/                ← JSONL event traces
    ├── evals/                 ← eval reports
    ├── token_usage.jsonl      ← cumulative token log
    └── plugins/               ← .mjs plugin files
```

---

## Context Files

HarnessFlow delivers three files as context to the agent on every run:

| File | Purpose | Who edits it |
|---|---|---|
| `CLAUDE.md` | Project instructions for the agent | **You** (keep ≤ 60 lines, universal rules only) |
| `.harness/feature_list.md` | Current features, architecture overview | **You** (update as project grows) |
| `.harness/handoff.md` | Summary of last session, next suggested task | **HarnessFlow** (auto-generated) |

> **CLAUDE.md best practice:** Include only instructions that apply to **every single session**. Avoid task-specific instructions, directory listings, or code style guidelines (use a linter hook instead). The more bloat in CLAUDE.md, the more likely Claude ignores it entirely.

---

## Commands

### `harness init`

Initialize HarnessFlow in the current project.

```bash
harness init [options]

Options:
  --backend <backend>   Default AI backend: claude | codex | dry-run  (default: claude)
  --force               Overwrite existing .harness.yaml
```

Creates: `.harness.yaml`, `CLAUDE.md`, `.harness/feature_list.md`, `.harness/handoff.md`, `.harness/plugins/`

---

### `harness run`

Start an agent session with a task description.

```bash
harness run "<task>" [options]

Options:
  --backend <backend>   AI backend: claude | codex | dry-run
  --model <model>       Model name (e.g. claude-opus-4-5, o3)
  --verbose             Show agent thinking and tool results
  --dry-run             Simulate without calling the actual CLI
```

**Examples:**
```bash
harness run "Refactor the auth module to use JWT"
harness run "Add dark mode" --backend claude --model claude-opus-4-5 --verbose
harness run "Explore the codebase" --dry-run
```

What happens:
1. Loads context (CLAUDE.md + feature_list + handoff)
2. Checks token budget — warns if over threshold
3. Detects prompt injection in task string
4. Fires `on_session_start` hooks
5. Fires `on_user_prompt` hooks
6. Streams agent events → fires `pre_tool` / `post_tool` hooks per tool call
7. Fires `on_stop` hooks when agent finishes (exit 2 = force continue)
8. Fires `on_session_end` hooks
9. Runs quality gates
10. Saves session state + generates handoff artifact

---

### `harness resume`

Resume the last session (or a specific session by ID).

```bash
harness resume [sessionId] [options]

Options:
  --backend <backend>   AI backend to use
  --verbose             Verbose output
```

```bash
harness resume                          # resume last session
harness resume sess_1745001234_abc123   # resume specific session
```

---

### `harness status`

Show current project and session state.

```bash
harness status [options]

Options:
  --traces   Show recent trace files
  --tokens   Show token usage history
  --json     Output as JSON
```

```bash
harness status
harness status --traces --tokens
harness status --json | jq .session.status
```

---

### `harness eval`

Evaluate a session trace and produce a quality report.

```bash
harness eval [sessionId] [options]

Options:
  --all    Evaluate all trace files
  --json   Output report as JSON
```

```bash
harness eval                # evaluate last session
harness eval --all --json   # all sessions, machine-readable
harness eval sess_abc123
```

Report includes: token usage, cost estimate, tool call count, files changed, status.

---

### `harness replay`

Replay a session trace for debugging and audit.

```bash
harness replay [sessionId] [options]

Options:
  --speed <n>      Playback speed multiplier (default: 1.0)
  --filter <type>  Only show events of type (e.g. tool_call, guardrail_block)
  --json           Output all events as JSON
```

```bash
harness replay                              # replay last session
harness replay sess_abc123 --filter tool_call
harness replay --json | jq 'select(.type=="guardrail_block")'
```

---

### `harness generate-claude`

Scaffold a `CLAUDE.md` from your `.harness.yaml` configuration.

```bash
harness generate-claude [options]

Options:
  --out <path>   Output path (default: CLAUDE.md)
```

> **Note:** This generates a minimal template based on your config. Edit the output manually — a hand-crafted CLAUDE.md outperforms an auto-generated one.

---

### `harness check`

Run quality gates manually (without running an agent session).

```bash
harness check [options]

Options:
  --gate <name>   Run only the named gate
  --verbose       Show gate output
  --json          Output as JSON
```

```bash
harness check
harness check --gate "TypeScript build"
harness check --json | jq '.results[] | select(.passed == false)'
```

---

### `harness spawn`

Orchestrate multiple tasks across isolated agent sessions.

```bash
harness spawn "<task1>" "<task2>" ... [options]

Options:
  --parallel         Run tasks in parallel (default: sequential)
  --backend <name>   AI backend for all tasks
  --json             Output results as JSON
```

```bash
harness spawn "Add auth module" "Write unit tests" "Update API docs"
harness spawn "Migrate schema" "Update frontend types" --parallel
harness spawn "task1" "task2" --json | jq '.results[].status'
```

---

### `harness plugin`

Manage HarnessFlow plugins.

```bash
harness plugin list [--json]          # list installed plugins
harness plugin scaffold <name>        # create a starter plugin
```

---

## Configuration Reference

Full `.harness.yaml` with all options:

```yaml
# AI backend selection
backend: claude          # claude | codex | dry-run
model: claude-opus-4-5   # optional — overridden by --model flag

# Context files delivered to the agent on every run
context:
  project_file: CLAUDE.md
  feature_list: .harness/feature_list.md
  session_state: .harness/session.json
  handoff: .harness/handoff.md
  additional_dirs: []    # extra dirs to include in context

# Token budget management
token_budget:
  max_context: 150000        # max tokens in context window
  reserve_for_output: 8000   # tokens reserved for agent output
  warning_threshold: 0.85    # warn when context > 85% of budget

# Guardrails
guardrails:
  mode: normal               # strict | normal | permissive
  allowed_tools:             # tool allowlist (deny-by-default)
    - Read
    - Write
    - Edit
    - Bash
    - Glob
    - Grep
  confirm_destructive: true  # prompt user before dangerous commands
  blocked_patterns:          # always blocked, regardless of mode
    - rm -rf
    - DROP TABLE
    - DROP DATABASE
    - git push --force
  injection_detection: true  # scan task string for prompt injection

# Hook lifecycle events (see Hook System section)
hooks:
  on_session_start:          # fires once before agent starts
    - script: .harness/hooks/setup.sh

  on_user_prompt:            # fires before task reaches agent
    - name: injection-check
      script: .harness/hooks/check-prompt.sh
      blocking: true

  pre_tool:                  # fires before every tool call
    - name: typecheck
      handler: script
      script: .harness/hooks/typecheck.sh
      on_tools: [Write, Edit]
      blocking: true
    - name: security-review
      handler: prompt
      evaluation_prompt: "Is this Bash command safe? PASS or FAIL."
      on_tools: [Bash]
      blocking: true
    - name: sanitize-command
      handler: script
      script: .harness/hooks/sanitize.sh
      on_tools: [Bash]
      modify_input: true     # hook can rewrite tool arguments

  post_tool:                 # fires after every successful tool call
    - script: .harness/hooks/format.sh
      on_tools: [Write, Edit]

  post_tool_failure:         # fires when a tool call errors
    - script: .harness/hooks/on-error.sh
      blocking: false

  on_stop:                   # fires when agent tries to finish
    - name: verify-tests
      handler: agent
      agent_task: "Check all tests pass. Use Read and Grep only."
      allowed_tools: [Read, Grep, Glob]
      blocking: true         # exit 2 forces agent to continue

  on_session_end:            # fires after session completes
    - script: .harness/hooks/cleanup.sh
      blocking: false

# Quality gates
quality_gates:
  - name: TypeScript build
    command: npx tsc --noEmit
    on: session_end          # always | session_end
    blocking: true           # non-zero exit blocks success status
    timeout: 60
  - name: Unit tests
    command: pnpm test
    on: session_end
    blocking: false
    timeout: 120

# Session management
session:
  checkpoint_every: 5        # save state every N events
  auto_handoff: true         # generate handoff.md after each session
  max_history: 50

# Observability
observability:
  trace_dir: .harness/traces
  eval_dir: .harness/evals
  token_log: .harness/token_usage.jsonl
  trace_format: jsonl        # jsonl | json
  auto_eval: true

# Plugin system
plugins:
  dir: .harness/plugins
  enabled: true
```

---

## Guardrails

Guardrails fire **deterministically** — they do not depend on the model remembering to follow rules.

### Modes

| Mode | Behavior |
|---|---|
| `strict` | Block any tool not in `allowed_tools`; block any pattern in `blocked_patterns` |
| `normal` | Block `blocked_patterns`; confirm other destructive commands before executing |
| `permissive` | Warn only; no blocking |

### Tool Allowlist

Only tools in `allowed_tools` are permitted. Any other tool call immediately aborts the session:

```yaml
guardrails:
  allowed_tools: [Read, Write, Edit, Bash, Glob, Grep]
```

### Blocked Patterns

Commands matching any pattern are always blocked (strict) or require confirmation (normal):

```yaml
guardrails:
  blocked_patterns:
    - rm -rf
    - DROP TABLE
    - DROP DATABASE
    - git push --force
    - curl.*| bash     # regex patterns supported
```

### Prompt Injection Detection

When `injection_detection: true`, the task string is scanned for common injection patterns before any session starts. Suspicious tasks are rejected immediately.

---

## Hook System

Hooks let you attach deterministic behavior at any point in the agent lifecycle — enforcing conventions the model cannot bypass.

### 7 Hook Events

| Event | When it fires | Can block? |
|---|---|---|
| `on_session_start` | Once, after plugins load, before agent starts | Yes |
| `on_user_prompt` | Once, before task reaches agent | Yes |
| `pre_tool` | Before every tool call | Yes + input modification |
| `post_tool` | After every successful tool call | No |
| `post_tool_failure` | When a tool call returns an error | No |
| `on_stop` | When agent finishes responding | `exit 2` = force-continue |
| `on_session_end` | After session completes (quality gates next) | No |

### 3 Handler Types

**`script`** (default) — shell script receives JSON context via stdin:

```yaml
pre_tool:
  - name: typecheck
    handler: script           # default, can be omitted
    script: .harness/hooks/typecheck.sh
    on_tools: [Write, Edit]
    blocking: true
    timeout: 30
```

Exit codes:
- `0` → pass
- `1` → fail (throws if `blocking: true`)
- `2` → `forceContinue` (only meaningful for `on_stop` — tells agent to keep working)

**`prompt`** — sends an evaluation prompt to Claude; expects `PASS` or `FAIL` on line 1:

```yaml
pre_tool:
  - name: security-check
    handler: prompt
    evaluation_prompt: |
      Review this Bash command. Does it look safe?
      Respond PASS or FAIL on the first line, then explain why.
    on_tools: [Bash]
    blocking: true
    model: claude-haiku-4-5   # optional, defaults to haiku
```

**`agent`** — spawns a sub-agent with restricted read-only tools for deep verification:

```yaml
on_stop:
  - name: verify-correctness
    handler: agent
    agent_task: "Read the changed files and verify all tests pass."
    allowed_tools: [Read, Grep, Glob]
    blocking: true
    timeout: 120
```

### stdin JSON Context

Every `script` hook receives this JSON via stdin:

```json
{
  "session_id": "sess_1745001234_abc123",
  "cwd": "/path/to/your/project",
  "hook_event": "pre_tool_use",
  "tool_name": "Bash",
  "tool_args": { "command": "npm test" },
  "tool_result": null,
  "task": "Add rate limiting to the auth endpoint",
  "backend": "claude"
}
```

Read it in your hook script:
```bash
#!/bin/sh
CONTEXT=$(cat)
TOOL=$(echo "$CONTEXT" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).tool_name || '')")
echo "Hook fired for tool: $TOOL" >&2
exit 0
```

### PreToolUse Input Modification

Hooks with `modify_input: true` can rewrite tool arguments **before** execution. The hook outputs JSON with a `modified_args` key:

```bash
#!/bin/sh
# Auto-add --dry-run to all npm commands
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  process.stdout.write(d.tool_args?.command || '');
")

if echo "$COMMAND" | grep -q "^npm "; then
  echo "{\"modified_args\": {\"command\": \"$COMMAND --dry-run\"}}"
else
  echo "{}"
fi
exit 0
```

Configure:
```yaml
pre_tool:
  - name: npm-dry-run
    script: .harness/hooks/npm-safe.sh
    on_tools: [Bash]
    modify_input: true
    blocking: false
```

---

## Quality Gates

Quality gates run shell commands to verify code quality — either manually or automatically at session end.

```yaml
quality_gates:
  - name: TypeScript build
    command: npx tsc --noEmit
    on: session_end            # "always" also runs on harness check
    blocking: true             # non-zero = mark session as having issues
    timeout: 60
  - name: Unit tests
    command: pnpm test --passWithNoTests
    on: session_end
    blocking: false
    timeout: 120
    working_dir: packages/api  # optional: run in a subdirectory
```

Run manually:
```bash
harness check                              # all gates
harness check --gate "TypeScript build"    # one gate
harness check --verbose                    # show output
harness check --json                       # machine-readable
```

Gates with `on: always` run both at session end **and** when `harness check` is called. Gates with `on: session_end` run only at session end and when `harness check` is called explicitly.

---

## Sub-agent Orchestration

`harness spawn` runs multiple tasks across isolated sessions. Each task gets its own session directory under `.harness/spawn/task-N/`.

```bash
# Sequential — tasks run in order, each sees output of previous
harness spawn \
  "Migrate the database schema to add user_preferences table" \
  "Update the User model to include preferences field" \
  "Write migration tests"

# Parallel — tasks run simultaneously, no shared state
harness spawn \
  "Update TypeScript types in packages/types" \
  "Update API documentation in docs/" \
  --parallel

# With specific backend
harness spawn "Task A" "Task B" --backend dry-run

# JSON results
harness spawn "Task A" "Task B" --json | jq '.results[] | {task, status, tokens}'
```

Output:
```
📋 Spawn Results (2 tasks, sequential)
┌──────┬─────────────────────┬───────────┬────────┬───────────────┐
│ Task │ Description         │ Status    │ Tokens │ Files Changed │
├──────┼─────────────────────┼───────────┼────────┼───────────────┤
│  1   │ Update TS types     │ COMPLETED │  4,231 │ 3             │
│  2   │ Update API docs     │ COMPLETED │  2,108 │ 2             │
└──────┴─────────────────────┴───────────┴────────┴───────────────┘
```

---

## Plugin System

Plugins are ESM modules (`.mjs`) placed in `.harness/plugins/`. They are loaded at session start and receive every session event.

### Scaffold a plugin

```bash
harness plugin scaffold slack-notifier
# Creates: .harness/plugins/slack-notifier.mjs
```

### Plugin interface

```js
// .harness/plugins/slack-notifier.mjs

export const name = "slack-notifier";
export const version = "1.0.0";
export const description = "Post session summaries to Slack";

// Called for every agent event
export async function onEvent(event) {
  if (event.type === "session_end" && event.status === "COMPLETED") {
    await fetch(process.env.SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Session completed: ${event.totalTokens} tokens, ${event.filesChanged} files changed`
      })
    });
  }
}

// Optional: hook into session lifecycle
export const hooks = {
  async onSessionStart(ctx) {
    console.log(`[slack-notifier] Session ${ctx.sessionId} starting`);
  },
  async onSessionEnd(ctx) {
    console.log(`[slack-notifier] Session ${ctx.sessionId} ended: ${ctx.status}`);
  }
};
```

### Event types received by plugins

| Event type | Fields |
|---|---|
| `session_start` | `task`, `backend` |
| `thinking` | `content` |
| `tool_call` | `tool`, `args` |
| `tool_result` | `result` |
| `message` | `content` |
| `error` | `error` |
| `done` | `usage` (`inputTokens`, `outputTokens`, `totalTokens`) |
| `session_end` | `status`, `sessionId`, `totalTokens`, `filesChanged` |

### List installed plugins

```bash
harness plugin list
harness plugin list --json
```

---

## Observability

Every session produces a complete audit trail.

### Trace files

Location: `.harness/traces/<session-id>.jsonl`

Each line is a JSON event:
```jsonl
{"ts":"2026-04-01T12:00:00Z","type":"session_start","task":"Add auth","backend":"claude"}
{"ts":"2026-04-01T12:00:01Z","type":"tool_call","tool":"Read","args":{"file_path":"src/auth.ts"}}
{"ts":"2026-04-01T12:00:02Z","type":"guardrail_block","reason":"tool:NetworkCall","action":"deny"}
{"ts":"2026-04-01T12:00:10Z","type":"token_usage","inputTokens":4231,"outputTokens":812}
{"ts":"2026-04-01T12:00:10Z","type":"session_end","status":"COMPLETED","filesChanged":3}
```

Query traces:
```bash
harness replay --filter tool_call          # show only tool calls
harness replay --filter guardrail_block    # show all blocks
harness replay --json | jq 'select(.type=="tool_call") | .tool'
```

### Eval reports

Location: `.harness/evals/<session-id>.json`

```bash
harness eval            # last session
harness eval --all      # all sessions
harness eval --json     # machine-readable
```

Sample report:
```json
{
  "sessionId": "sess_1745001234_abc",
  "status": "COMPLETED",
  "tokenUsage": { "inputTokens": 4231, "outputTokens": 812, "totalTokens": 5043 },
  "estimatedCost": "$0.0756",
  "toolCallCount": 12,
  "filesChanged": ["src/auth.ts", "src/auth.test.ts"],
  "guardrailBlocks": 0,
  "durationMs": 9210
}
```

### Token log

Location: `.harness/token_usage.jsonl`

Cumulative log of token usage across all sessions:
```bash
# Total tokens spent this week
cat .harness/token_usage.jsonl | \
  node -e "
    const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\n');
    const total = lines.map(l=>JSON.parse(l)).reduce((a,b)=>a+b.totalTokens,0);
    console.log('Total tokens:', total.toLocaleString());
  "
```

---

## Session Lifecycle

```
harness run "<task>"
       │
       ▼
  Load context (CLAUDE.md + feature_list + handoff)
       │
       ▼
  Check token budget ──► warn if > 85%
       │
       ▼
  Prompt injection scan ──► abort if detected
       │
       ▼
  Load plugins
       │
       ▼
  Fire on_session_start hooks
       │
       ▼
  Fire on_user_prompt hooks
       │
       ▼
  ┌─── Stream agent events ───────────────────┐
  │                                           │
  │   tool_call ──► guardrail check           │
  │              ──► pre_tool hooks           │
  │              ──► (modify tool args?)      │
  │              ──► execute tool             │
  │                                           │
  │   tool_result ──► post_tool hooks         │
  │                                           │
  │   error ──► post_tool_failure hooks       │
  │                                           │
  └────────────────────────────────────────────┘
       │
       ▼
  Fire on_stop hooks ──► exit 2 = force-continue
       │
       ▼
  Fire on_session_end hooks
       │
       ▼
  Run quality gates
       │
       ▼
  Save session.json + generate handoff.md
       │
       ▼
  Print summary (tokens, cost, files, trace path)
```

Session states: `RUNNING` → `COMPLETED` | `FAILED` | `INTERRUPTED`

---

## Architecture

```
artifacts/harness-flow/
├── src/
│   ├── index.ts                 CLI entry — commander.js program
│   ├── types.ts                 Zod schemas + TypeScript types
│   ├── config.ts                .harness.yaml loader + defaults
│   ├── utils.ts                 Shared utilities
│   │
│   ├── adapters/
│   │   ├── interface.ts         AgentAdapter interface, GuardrailAbortError
│   │   ├── claude.ts            Claude CLI adapter (streams JSON events)
│   │   ├── codex.ts             Codex CLI adapter
│   │   └── dry-run.ts           Dry-run adapter for testing
│   │
│   ├── session/
│   │   └── runner.ts            Main orchestration loop
│   │
│   ├── context/
│   │   └── manager.ts           Load/save context, session, handoff
│   │
│   ├── prompt/
│   │   └── engine.ts            Build prompts, token budget, templates
│   │
│   ├── guardrail/
│   │   └── layer.ts             Tool allowlist, pattern blocking, injection
│   │
│   ├── hooks/
│   │   └── runner.ts            HookRunner: script/prompt/agent handlers
│   │
│   ├── quality/
│   │   └── runner.ts            QualityGateRunner
│   │
│   ├── plugins/
│   │   └── loader.ts            ESM plugin loader
│   │
│   ├── telemetry/
│   │   └── tracer.ts            JSONL tracer, token log, eval writer
│   │
│   └── commands/
│       ├── init.ts              harness init
│       ├── run.ts               harness run
│       ├── resume.ts            harness resume
│       ├── status.ts            harness status
│       ├── eval.ts              harness eval
│       ├── replay.ts            harness replay
│       ├── generate-claude.ts   harness generate-claude
│       ├── check.ts             harness check
│       ├── spawn.ts             harness spawn
│       └── plugin.ts            harness plugin list/scaffold
│
├── scripts/
│   └── e2e-test.mjs             66 E2E integration tests
│
├── build.mjs                    esbuild config (CJS + ESM bundles)
├── jest.config.mjs              Jest config (ESM + ts-jest)
├── tsconfig.json                TypeScript config
└── package.json                 v0.2.0, bin: harness
```

### Key interfaces

```typescript
// Every AI backend implements this
interface AgentAdapter {
  name: string;
  run(request: AgentRequest): AsyncIterable<AgentEvent>;
  resume(sessionId: string, task: string): AsyncIterable<AgentEvent>;
}

// Events streamed from the agent
type AgentEvent =
  | { type: "thinking"; content: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; result: string }
  | { type: "message"; content: string }
  | { type: "error"; error: string }
  | { type: "done"; usage: TokenUsage };

// Context passed to every hook script via stdin
interface HookContext {
  session_id: string;
  cwd: string;
  hook_event: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  tool_result?: string;
  task?: string;
  backend?: string;
}
```

---

## Recipes

### Enforce TypeScript on every file save

```yaml
hooks:
  post_tool:
    - name: typecheck
      script: .harness/hooks/typecheck.sh
      on_tools: [Write, Edit]
      blocking: false
```

```bash
# .harness/hooks/typecheck.sh
#!/bin/sh
npx tsc --noEmit 2>&1 | tail -20
```

### Block npm install without explicit approval

```yaml
guardrails:
  blocked_patterns:
    - npm install
    - pnpm add
    - yarn add
```

### Auto-format on every file write

```yaml
hooks:
  post_tool:
    - name: prettier
      handler: script
      script: .harness/hooks/format.sh
      on_tools: [Write, Edit]
```

```bash
# .harness/hooks/format.sh
#!/bin/sh
CONTEXT=$(cat)
FILE=$(echo "$CONTEXT" | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  process.stdout.write(d.tool_args?.file_path || d.tool_args?.path || '');
")
[ -n "$FILE" ] && npx prettier --write "$FILE" 2>/dev/null
exit 0
```

### Prevent agent from stopping until tests pass

```yaml
hooks:
  on_stop:
    - name: test-gate
      script: .harness/hooks/test-gate.sh
      blocking: true
```

```bash
# .harness/hooks/test-gate.sh
#!/bin/sh
pnpm test --passWithNoTests 2>&1
if [ $? -ne 0 ]; then
  echo "Tests are failing — agent must fix before finishing" >&2
  exit 2    # exit 2 = force agent to continue
fi
exit 0
```

### Notify Slack when session completes

```js
// .harness/plugins/slack.mjs
export const name = "slack";
export const version = "1.0.0";

export async function onEvent(event) {
  if (event.type !== "session_end") return;
  const icon = event.status === "COMPLETED" ? "✅" : "❌";
  await fetch(process.env.SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${icon} *HarnessFlow* — ${event.status}\n${event.totalTokens?.toLocaleString()} tokens · ${event.filesChanged} files`
    })
  }).catch(() => {});
}
```

### Run two agents in parallel on independent tasks

```bash
harness spawn \
  "Update the OpenAPI spec in docs/api.yaml to add the new /users/preferences endpoint" \
  "Add the corresponding TypeScript types to packages/types/src/user.ts" \
  --parallel --json
```

---

## Harness Engineering

HarnessFlow is built on principles from [12-factor-agents](https://github.com/humanlayer/12-factor-agents), the [awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering) curated list, and [HumanLayer's harness engineering blog](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents).

**Core idea:** Agent = Model + Harness. The model contains intelligence; the harness makes that intelligence reliable.

| Principle | How HarnessFlow implements it |
|---|---|
| Context is the only lever | Token budget, context trimming, minimal CLAUDE.md |
| Deterministic guardrails | Hooks fire on every event, not when model "remembers" |
| Hooks over prompts | Shell scripts enforce formatting/linting, not CLAUDE.md instructions |
| Pause & resume | Session state + handoff artifacts across sessions |
| Minimal agent surface | Tool allowlist — deny by default |
| Observability | Every event traced; every session evaluable |
| Human in the loop | `confirm_destructive` — user approves dangerous commands |
| Error compression | `post_tool_failure` hooks to format errors for the model |
| Modularity | Adapters, hooks, plugins, gates — each independently testable |
| Minimal CLAUDE.md | Generate a template with `generate-claude`, then trim aggressively |

---

## Tests

```bash
# Unit tests (9 suites, 81 tests)
pnpm test

# E2E integration tests (12 scenarios, 66 assertions)
node scripts/e2e-test.mjs
```

Test coverage:
- Config loading and schema validation
- Guardrail layer (tool allowlist, command blocking, injection detection)
- Hook runner (script/prompt/agent handlers, stdin context, modify_input, exit 2)
- Hook config (all 7 event types, all 3 handler types)
- Quality gate runner (blocking/non-blocking, trigger filters)
- Plugin loader (ESM loading, error isolation, lifecycle hooks)
- Context manager (load, trim, session save/restore)
- Prompt engine (templates, token budget, handoff/verification prompts)
- Dry-run adapter (full session simulation)

---

## Contributing

```bash
git clone https://github.com/kencomus-byte/harnessflow-cli.git
cd harnessflow-cli/artifacts/harness-flow
pnpm install

# Build
node build.mjs

# Test
pnpm test
node scripts/e2e-test.mjs

# Link locally
npm link
harness --version
```

Adding a new backend adapter:
1. Create `src/adapters/my-backend.ts` implementing `AgentAdapter`
2. Add `"my-backend"` to the backend enum in `src/types.ts`
3. Register it in `src/commands/run.ts`

Adding a new command:
1. Create `src/commands/my-command.ts`
2. Register it in `src/index.ts`
3. Add E2E coverage in `scripts/e2e-test.mjs`

---

## License

MIT — see [LICENSE](LICENSE)
