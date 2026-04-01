import { AgentEvent, AgentRequest, TokenUsage } from "../types.js";

export interface AgentAdapter {
  readonly name: string;

  isAvailable(): Promise<boolean>;

  run(request: AgentRequest): AsyncGenerator<AgentEvent>;

  resume(sessionId: string, task: string): AsyncGenerator<AgentEvent>;

  estimateTokens(text: string): Promise<number>;
}

export function combinePrompt(systemPrompt: string, task: string): string {
  return `${systemPrompt}\n\n---\n\n## Current Task\n\n${task}`;
}

export function makeEmptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

/**
 * Thrown by guardrail checks in handleEvent to abort the session immediately.
 * Propagates out of the event loop, interrupting the agent process stream.
 */
export class GuardrailAbortError extends Error {
  constructor(public reason: string) {
    super(`Guardrail abort: ${reason}`);
    this.name = "GuardrailAbortError";
  }
}
