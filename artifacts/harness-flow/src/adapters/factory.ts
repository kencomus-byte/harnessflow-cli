import { HarnessConfig } from "../types.js";
import { AgentAdapter } from "./interface.js";
import { ClaudeCliAdapter } from "./claude/adapter.js";
import { CodexCliAdapter } from "./codex/adapter.js";
import { DryRunAdapter } from "./dry-run/adapter.js";

export async function createAdapter(config: HarnessConfig): Promise<AgentAdapter> {
  const backend = config.backend;

  let adapter: AgentAdapter;

  switch (backend) {
    case "claude":
      adapter = new ClaudeCliAdapter();
      break;
    case "codex":
      adapter = new CodexCliAdapter();
      break;
    case "dry-run":
      return new DryRunAdapter();
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unknown backend: ${exhaustive}`);
    }
  }

  const available = await adapter.isAvailable();
  if (!available) {
    console.warn(
      `Warning: ${backend} CLI not found. Falling back to dry-run mode.`
    );
    console.warn(`Install ${backend} CLI and ensure it is in your PATH.`);
    return new DryRunAdapter();
  }

  return adapter;
}
