import { spawn } from "child_process";
import { AgentAdapter, combinePrompt } from "../interface.js";
import { AgentEvent, AgentRequest } from "../../types.js";
import { estimateTokens } from "../../utils.js";

export class CodexCliAdapter implements AgentAdapter {
  readonly name = "codex";

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("codex", ["--version"], { stdio: "pipe" });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  async *run(request: AgentRequest): AsyncGenerator<AgentEvent> {
    const args = [
      "--quiet",
      "--approval-mode",
      "suggest",
    ];

    if (request.model) {
      args.push("--model", request.model);
    }

    const fullPrompt = combinePrompt(request.systemPrompt, request.task);

    const proc = spawn("codex", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    proc.stdin.write(fullPrompt);
    proc.stdin.end();

    let outputText = "";
    for await (const chunk of proc.stdout) {
      const text = chunk.toString();
      outputText += text;
      yield { type: "message", content: text };
    }

    await new Promise<void>((resolve) => proc.on("close", resolve));

    const inputTokens = estimateTokens(fullPrompt);
    const outputTokens = estimateTokens(outputText);

    yield {
      type: "done",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }

  async *resume(_sessionId: string, task: string): AsyncGenerator<AgentEvent> {
    yield {
      type: "message",
      content: `Codex CLI does not support session resume. Starting fresh with task: ${task}`,
    };
    yield {
      type: "done",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  async estimateTokens(text: string): Promise<number> {
    return estimateTokens(text);
  }
}
