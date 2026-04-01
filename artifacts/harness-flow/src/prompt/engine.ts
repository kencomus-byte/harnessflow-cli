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
