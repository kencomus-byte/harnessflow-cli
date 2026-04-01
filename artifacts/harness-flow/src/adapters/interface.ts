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
