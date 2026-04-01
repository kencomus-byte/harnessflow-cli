# HarnessFlow CLI

> TypeScript harness layer between users and AI coding agents (Claude CLI, Codex CLI)

```
User → HarnessFlow CLI → Adapter → Claude CLI / Codex CLI
```

HarnessFlow manages context, session state, guardrails, hooks, observability, quality gates, sub-agent orchestration, and plugins — everything **except** the model itself.

---

## Install

```bash
npm install -g harnessflow-cli
# or build from source:
git clone https://github.com/kencomus-byte/harnessflow-cli.git
cd harnessflow-cli/artifacts/harness-flow
pnpm install && node build.mjs && npm link
```

---

## Quick Start

```bash
# 1. Initialize in your project
harness init

# 2. Run a task
harness run "Add input validation to the auth module" --backend claude

# 3. Check session status
harness status
```

---

## Commands

| Command | Description |
|---|---|
| `harness init` | Initialize `.harness.yaml` + context files in current project |
| `harness run "<task>"` | Start a new agent session |
| `harness resume [session-id]` | Resume the last (or specified) session |
| `harness status` | Show session state, token usage, traces |
| `harness eval [session-id]` | Evaluate a session: tokens, tool calls, quality |
| `harness replay [session-id]` | Replay events from a trace file |
| `harness generate-claude` | Auto-generate `CLAUDE.md` from `.harness.yaml` config |
| `harness check [--gate <name>]` | Run quality gates manually |
| `harness spawn "<t1>" "<t2>"` | Orchestrate multiple tasks (sequential or `--parallel`) |
| `harness plugin list` | List installed plugins |
| `harness plugin scaffold <name>` | Create a starter plugin file |

---

## Configuration (`.harness.yaml`)

```yaml
backend: claude          # claude | codex | dry-run
model: claude-opus-4-5

guardrails:
  mode: normal           # strict | normal | permissive
  allowed_tools: [Read, Write, Edit, Bash, Glob, Grep]
  confirm_destructive: true
  injection_detection: true

hooks:
  on_session_start:
    - script: .harness/hooks/setup.sh
  pre_tool:
    - name: typecheck
      handler: script
      script: .harness/hooks/typecheck.sh
      on_tools: [Write, Edit]
      blocking: true
    - name: security-review
      handler: prompt
      evaluation_prompt: "Is this Bash command safe to run? PASS or FAIL."
      on_tools: [Bash]
      blocking: true
  post_tool:
    - script: .harness/hooks/lint.sh
      modify_input: false
  on_stop:
    - name: verify-tests
      handler: agent
      agent_task: "Verify all tests pass. Check with grep and read."
      blocking: true
  on_session_end:
    - script: .harness/hooks/report.sh

quality_gates:
  - name: TypeScript build
    command: npx tsc --noEmit
    on: session_end
    blocking: true
  - name: Unit tests
    command: pnpm test
    timeout: 120
    on: session_end

token_budget:
  max_context: 150000
  reserve_for_output: 8000
  warning_threshold: 0.85

plugins:
  dir: .harness/plugins
  enabled: true
```

---

## Hook System

HarnessFlow supports **7 hook event types** and **3 handler types**, modeled after Claude Code's lifecycle hooks.

### Events

| Event | When | Can Block? |
|---|---|---|
| `on_session_start` | Session begins | Yes |
| `on_user_prompt` | Before prompt reaches agent | Yes |
| `pre_tool` | Before any tool executes | Yes (+ input modification) |
| `post_tool` | After tool completes | No |
| `post_tool_failure` | After tool errors | No |
| `on_stop` | Agent finishes responding | exit 2 = force-continue |
| `on_session_end` | Session terminates | No |

### Handler Types

**`script`** (default) — shell script, receives JSON context via stdin:
```yaml
pre_tool:
  - handler: script
    script: .harness/hooks/typecheck.sh
    on_tools: [Write, Edit]
    blocking: true
    modify_input: false    # set true to return modified tool args
```

**`prompt`** — evaluation prompt sent to Claude (returns PASS/FAIL):
```yaml
pre_tool:
  - handler: prompt
    evaluation_prompt: "Is this command safe? PASS or FAIL."
    on_tools: [Bash]
    blocking: true
```

**`agent`** — sub-agent with read-only tools for deep verification:
```yaml
on_stop:
  - handler: agent
    agent_task: "Verify all tests pass before finishing."
    allowed_tools: [Read, Grep, Glob]
    blocking: true
```

### stdin Context (all script hooks)

```json
{
  "session_id": "sess_abc123",
  "cwd": "/path/to/project",
  "hook_event": "pre_tool_use",
  "tool_name": "Bash",
  "tool_args": { "command": "npm test" },
  "task": "Add auth module",
  "backend": "claude"
}
```

### PreToolUse Input Modification

Hooks with `modify_input: true` can intercept and rewrite tool arguments:
```bash
#!/bin/sh
# Read context from stdin, output modified args
INPUT=$(cat)
echo '{"modified_args": {"command": "npm test -- --dry-run"}}'
```

---

## Quality Gates

```bash
harness check              # run all gates
harness check --gate "TypeScript build"
harness check --json
```

Gates run automatically at session end when configured with `on: session_end`.

---

## Sub-agent Orchestration

```bash
# Sequential (default)
harness spawn "Add auth module" "Write unit tests" "Update docs"

# Parallel
harness spawn "Migrate DB schema" "Update frontend types" --parallel

# JSON output
harness spawn "task1" "task2" --json
```

Each task runs in an isolated session directory under `.harness/spawn/`.

---

## Plugin System

Plugins are ESM modules in `.harness/plugins/*.mjs`:

```bash
harness plugin scaffold my-notifier   # creates starter plugin
harness plugin list                   # show installed plugins
```

Plugin interface:
```js
export const name = "my-notifier";
export const version = "1.0.0";

export async function onEvent(event) {
  if (event.type === "session_end") {
    console.log(`Session ${event.sessionId} finished: ${event.status}`);
  }
}
```

---

## Observability

- **Traces**: `.harness/traces/<session-id>.jsonl` — every event logged
- **Evals**: `.harness/evals/<session-id>.json` — quality report
- **Token log**: `.harness/token_usage.jsonl` — cumulative token usage

```bash
harness eval                   # evaluate last session
harness eval <session-id>
harness eval --json
harness replay <session-id>    # replay trace events
```

---

## Architecture

```
artifacts/harness-flow/src/
├── index.ts              # CLI entry (commander.js)
├── types.ts              # Zod schemas + TypeScript types
├── config.ts             # .harness.yaml loader
├── adapters/
│   ├── interface.ts      # AgentAdapter interface + GuardrailAbortError
│   ├── claude.ts         # Claude CLI adapter
│   ├── codex.ts          # Codex CLI adapter
│   └── dry-run.ts        # Dry-run adapter (testing)
├── session/
│   └── runner.ts         # SessionRunner (main orchestration loop)
├── context/
│   └── manager.ts        # Context loading, session save/restore
├── prompt/
│   └── engine.ts         # Prompt building, token budget, templates
├── guardrail/
│   └── layer.ts          # Tool allowlist, pattern blocking, injection detection
├── hooks/
│   └── runner.ts         # HookRunner (script/prompt/agent handlers)
├── quality/
│   └── runner.ts         # QualityGateRunner
├── plugins/
│   └── loader.ts         # PluginLoader (ESM .mjs plugins)
├── telemetry/
│   └── tracer.ts         # Tracer (JSONL traces, token log, evals)
└── commands/
    ├── init.ts
    ├── run.ts
    ├── resume.ts
    ├── status.ts
    ├── eval.ts
    ├── replay.ts
    ├── generate-claude.ts
    ├── check.ts
    ├── spawn.ts
    └── plugin.ts
```

---

## Tests

```bash
pnpm test          # 81 unit tests (9 suites)
node scripts/e2e-test.mjs   # 66 E2E integration tests
```

---

## Harness Engineering

HarnessFlow is built on principles from the [12-factor-agents](https://github.com/humanlayer/12-factor-agents) spec and [harness engineering](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents) practices:

- **Context efficiency**: trim, budget, and prioritize what goes in the context window
- **Deterministic guardrails**: rules fire every time, not just when the model "remembers"
- **Hooks over prompts**: use deterministic shell scripts instead of asking the model to format code
- **Minimal CLAUDE.md**: keep it under 60 lines, universal-only instructions
- **Observability first**: every event traced, every session evaluable

---

## License

MIT
