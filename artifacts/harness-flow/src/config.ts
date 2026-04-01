import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { HarnessConfig, HarnessConfigSchema } from "./types.js";

const CONFIG_FILENAME = ".harness.yaml";

export function loadConfig(projectRoot: string): HarnessConfig {
  const configPath = resolve(projectRoot, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    return HarnessConfigSchema.parse({});
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = yaml.load(raw);
    return HarnessConfigSchema.parse(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Warning: Failed to parse .harness.yaml: ${msg}`);
    return HarnessConfigSchema.parse({});
  }
}

export function getDefaultConfigYaml(): string {
  return `# HarnessFlow Configuration
# Docs: https://github.com/your-org/harness-flow

# Backend AI CLI (claude | codex | dry-run)
backend: claude
# model: claude-opus-4-5

context:
  project_file: CLAUDE.md
  feature_list: .harness/feature_list.md
  session_state: .harness/session.json
  handoff: .harness/handoff.md

token_budget:
  max_context: 150000
  reserve_for_output: 8000
  warning_threshold: 0.85

guardrails:
  mode: normal           # strict | normal | permissive
  allowed_tools:
    - Read
    - Write
    - Edit
    - Bash
    - Glob
    - Grep
  confirm_destructive: true
  blocked_patterns:
    - "rm -rf"
    - "DROP TABLE"
    - "DROP DATABASE"
    - "git push --force"
    - "git push -f"

hooks:
  pre_tool: []
  post_tool: []
  on_session_end: []

session:
  checkpoint_every: 5
  auto_handoff: true
  max_history: 50

observability:
  trace_dir: .harness/traces
  eval_dir: .harness/evals
  token_log: .harness/token_usage.jsonl
  auto_eval: true
`;
}
