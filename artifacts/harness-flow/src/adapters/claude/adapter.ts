import { spawn } from "child_process";
import { AgentAdapter, combinePrompt } from "../interface.js";
import { AgentEvent, AgentRequest } from "../../types.js";
import { estimateTokens } from "../../utils.js";

interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export class ClaudeCliAdapter implements AgentAdapter {
  readonly name = "claude";

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("claude", ["--version"], { stdio: "pipe" });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  async *run(request: AgentRequest): AsyncGenerator<AgentEvent> {
    const args = this.buildArgs(request);
    const fullPrompt = combinePrompt(request.systemPrompt, request.task);

    yield* this.spawnAndStream(args, fullPrompt);
  }

  async *resume(sessionId: string, task: string): AsyncGenerator<AgentEvent> {
    const args = ["--resume", sessionId, "--print", "--output-format", "stream-json"];
    yield* this.spawnAndStream(args, task);
  }

  async estimateTokens(text: string): Promise<number> {
    return estimateTokens(text);
  }

  private buildArgs(request: AgentRequest): string[] {
    const args = ["--print", "--output-format", "stream-json"];

    if (request.model) {
      args.push("--model", request.model);
    }

    if (request.allowedTools.length > 0) {
      args.push("--allowedTools", request.allowedTools.join(","));
    }

    return args;
  }

  private async *spawnAndStream(
    args: string[],
    prompt: string
  ): AsyncGenerator<AgentEvent> {
    const proc = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    proc.stdin.write(prompt);
    proc.stdin.end();

    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let hasError = false;

    for await (const chunk of proc.stdout) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const event = tryParseEvent(trimmed);
        if (!event) continue;

        if (event.type === "thinking" && event.content) {
          yield { type: "thinking", content: event.content };
        } else if (event.type === "tool_call" && event.tool) {
          yield {
            type: "tool_call",
            tool: event.tool,
            args: event.args ?? {},
          };
        } else if (event.type === "tool_result" && event.result !== undefined) {
          yield { type: "tool_result", result: event.result };
        } else if (event.type === "message" && event.content) {
          yield { type: "message", content: event.content };
        } else if (event.type === "usage" && event.usage) {
          inputTokens = event.usage.input_tokens;
          outputTokens = event.usage.output_tokens;
        }
      }
    }

    let stderrOutput = "";
    for await (const chunk of proc.stderr) {
      stderrOutput += chunk.toString();
    }

    await new Promise<void>((resolve, reject) => {
      proc.on("close", (code) => {
        if (code !== 0 && !hasError) {
          hasError = true;
          reject(new Error(`claude exited with code ${code}: ${stderrOutput.slice(0, 500)}`));
        } else {
          resolve();
        }
      });
    });

    yield {
      type: "done",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }
}

function tryParseEvent(line: string): ClaudeStreamEvent | null {
  try {
    return JSON.parse(line) as ClaudeStreamEvent;
  } catch {
    if (line.startsWith("data: ")) {
      try {
        return JSON.parse(line.slice(6)) as ClaudeStreamEvent;
      } catch {
        return null;
      }
    }
    return null;
  }
}
