import { AgentAdapter } from "../interface.js";
import { AgentEvent, AgentRequest } from "../../types.js";
import { estimateTokens } from "../../utils.js";

export class DryRunAdapter implements AgentAdapter {
  readonly name = "dry-run";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async *run(request: AgentRequest): AsyncGenerator<AgentEvent> {
    yield { type: "thinking", content: "[DRY RUN] Processing request..." };

    await sleep(100);
    yield {
      type: "tool_call",
      tool: "Read",
      args: { file: "CLAUDE.md" },
    };

    await sleep(50);
    yield {
      type: "tool_result",
      result: "[DRY RUN] File contents (simulated)",
    };

    await sleep(100);
    yield {
      type: "message",
      content: `[DRY RUN] Task completed (simulated)\n\nTask: "${request.task.slice(0, 100)}"\nBackend: dry-run\n\nThis is a dry-run — no actual AI was called. Use --backend claude or --backend codex for real execution.`,
    };

    yield {
      type: "done",
      usage: {
        inputTokens: estimateTokens(request.systemPrompt + request.task),
        outputTokens: 50,
        totalTokens: estimateTokens(request.systemPrompt + request.task) + 50,
      },
    };
  }

  async *resume(_sessionId: string, task: string): AsyncGenerator<AgentEvent> {
    yield { type: "thinking", content: "[DRY RUN] Resuming session..." };
    yield {
      type: "message",
      content: `[DRY RUN] Resumed session for task: "${task}"`,
    };
    yield {
      type: "done",
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    };
  }

  async estimateTokens(text: string): Promise<number> {
    return estimateTokens(text);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
