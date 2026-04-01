import { resolve } from "path";
import { ContextBundle, HarnessConfig } from "../types.js";
import { readFileOrDefault, estimateTokens } from "../utils.js";

const DEFAULT_SYSTEM_TEMPLATE = `You are working on {{project_name}}.

## Project Instructions
{{project_instructions}}

## Previous Session Summary
{{session_summary}}

## Feature Status
{{feature_list}}

## Handoff from Previous Session
{{handoff}}

## Working Rules
- Make incremental progress — do not try to do everything at once
- After each small step, verify with tests or type checks
- Document what you did and what remains
- Do not delete code without asking first
- If you are unsure about something, ask before acting`;

export class PromptEngine {
  private templateDir: string;

  constructor(
    private projectRoot: string,
    private config: HarnessConfig
  ) {
    this.templateDir = resolve(projectRoot, ".harness", "prompts");
  }

  buildSystemPrompt(context: ContextBundle, projectName: string): string {
    const template = readFileOrDefault(
      resolve(this.templateDir, "system.md"),
      DEFAULT_SYSTEM_TEMPLATE
    );

    return this.renderTemplate(template, {
      project_name: projectName,
      project_instructions: context.projectInstructions,
      session_summary: context.sessionSummary,
      feature_list: context.featureList,
      handoff: context.handoff,
    });
  }

  buildTaskPrompt(task: string): string {
    const template = readFileOrDefault(
      resolve(this.templateDir, "task.md"),
      `## Task\n\n{{task}}\n\nPlease work on this incrementally and verify each step.`
    );

    return this.renderTemplate(template, { task });
  }

  checkTokenBudget(
    systemPrompt: string,
    taskPrompt: string
  ): {
    totalEstimate: number;
    remainingBudget: number;
    isWarning: boolean;
    isOverBudget: boolean;
  } {
    const { max_context, reserve_for_output, warning_threshold } =
      this.config.token_budget;

    const available = max_context - reserve_for_output;
    const used = estimateTokens(systemPrompt) + estimateTokens(taskPrompt);
    const remaining = available - used;
    const usageRatio = used / available;

    return {
      totalEstimate: used,
      remainingBudget: remaining,
      isWarning: usageRatio >= warning_threshold,
      isOverBudget: used > available,
    };
  }

  trimContextIfNeeded(context: ContextBundle): ContextBundle {
    const { max_context, reserve_for_output } = this.config.token_budget;
    const available = max_context - reserve_for_output;

    if (context.totalTokensEstimate <= available) {
      return context;
    }

    let trimmed = { ...context };
    const overage = context.totalTokensEstimate - available;

    const featureTokens = estimateTokens(context.featureList);
    if (featureTokens > overage / 2) {
      const lines = context.featureList.split("\n");
      const keepLines = Math.floor(lines.length * 0.5);
      trimmed.featureList =
        lines.slice(0, keepLines).join("\n") + "\n\n[...trimmed for token budget]";
    }

    return trimmed;
  }

  /**
   * Builds a prompt that asks the AI to write a handoff artifact summarizing the session.
   * Injected at the end of a session so the AI can document what it did.
   */
  buildHandoffPrompt(task: string): string {
    const template = readFileOrDefault(
      resolve(this.templateDir, "handoff.md"),
      DEFAULT_HANDOFF_TEMPLATE
    );

    return this.renderTemplate(template, { task });
  }

  /**
   * Builds a verification prompt asking the AI to check its own work.
   * Injected before session end to prompt self-review.
   */
  buildVerificationPrompt(task: string): string {
    const template = readFileOrDefault(
      resolve(this.templateDir, "verification.md"),
      DEFAULT_VERIFICATION_TEMPLATE
    );

    return this.renderTemplate(template, { task });
  }

  private renderTemplate(
    template: string,
    vars: Record<string, string>
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }
    return result;
  }
}

const DEFAULT_HANDOFF_TEMPLATE = `## Handoff Request

The current session is ending. Please write a handoff summary covering:

### Task
{{task}}

### Please document:
1. **What was accomplished** — specific files changed, features completed, tests added
2. **What still needs to be done** — remaining TODO items, partial work
3. **Blockers** — any issues that prevented completion
4. **Critical files** — which files the next session should read first
5. **Suggested next task** — what should the next agent session work on?

Write this into the handoff.md file now.
`;

const DEFAULT_VERIFICATION_TEMPLATE = `## Self-Verification Checklist

Before ending the session, verify the following for task: {{task}}

1. **Tests pass**: Run \`pnpm test\` (or equivalent) and confirm all tests pass
2. **Types check**: Run \`pnpm typecheck\` (or equivalent) and confirm 0 errors
3. **Code quality**: Review your changes for obvious mistakes or oversights
4. **Acceptance criteria**: Re-read the original task — did you address everything?
5. **Edge cases**: Are there obvious edge cases you haven't handled?

If any of the above fails, fix the issue before completing the session.
`;
