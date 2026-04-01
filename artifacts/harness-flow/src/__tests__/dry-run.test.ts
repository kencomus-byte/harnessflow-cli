import { describe, it, expect } from "@jest/globals";
import { DryRunAdapter } from "../adapters/dry-run/adapter.js";
import { AgentEvent } from "../types.js";

describe("DryRunAdapter", () => {
  it("is always available", async () => {
    const adapter = new DryRunAdapter();
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("emits thinking, tool_call, message, and done events", async () => {
    const adapter = new DryRunAdapter();
    const events: AgentEvent[] = [];

    for await (const event of adapter.run({
      task: "Write hello world",
      systemPrompt: "You are a helpful assistant",
      context: "",
      allowedTools: ["Read"],
    })) {
      events.push(event);
    }

    const types = events.map((e) => e.type);
    expect(types).toContain("thinking");
    expect(types).toContain("tool_call");
    expect(types).toContain("message");
    expect(types).toContain("done");
  });

  it("done event includes token usage", async () => {
    const adapter = new DryRunAdapter();
    let doneEvent: AgentEvent | undefined;

    for await (const event of adapter.run({
      task: "Test task",
      systemPrompt: "System prompt here",
      context: "",
      allowedTools: [],
    })) {
      if (event.type === "done") {
        doneEvent = event;
      }
    }

    expect(doneEvent).toBeDefined();
    if (doneEvent?.type === "done") {
      expect(doneEvent.usage.totalTokens).toBeGreaterThan(0);
      expect(doneEvent.usage.inputTokens).toBeGreaterThan(0);
    }
  });

  it("resume emits thinking, message, and done events", async () => {
    const adapter = new DryRunAdapter();
    const events: AgentEvent[] = [];

    for await (const event of adapter.resume("session-test", "Continue building")) {
      events.push(event);
    }

    const types = events.map((e) => e.type);
    expect(types).toContain("thinking");
    expect(types).toContain("message");
    expect(types).toContain("done");
  });

  it("estimateTokens returns a number", async () => {
    const adapter = new DryRunAdapter();
    const count = await adapter.estimateTokens("Hello world this is a test string");
    expect(count).toBeGreaterThan(0);
  });
});
