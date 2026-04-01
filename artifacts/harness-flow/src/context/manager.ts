import { existsSync } from "fs";
import { resolve } from "path";
import { HarnessConfig, ContextBundle, SessionState } from "../types.js";
import { readFileOrDefault, estimateTokens, formatTimestamp, generateSessionId, writeFileSafe } from "../utils.js";

const DEFAULT_CLAUDE_MD = `# Project Instructions

## What this project does
[Describe your project here]

## Tech stack
[List your main technologies]

## How to work on this project
- Run \`pnpm dev\` to start the development server
- Run \`pnpm test\` to run tests
- Run \`pnpm typecheck\` to check types

## Important conventions
- [Add your conventions here]
`;

const DEFAULT_FEATURE_LIST = `# Feature List

## Done (DONE)
<!-- Completed features go here -->

## In Progress (WIP)
<!-- Features currently being worked on -->

## To Do (TODO)
<!-- Planned features -->

## Known Bugs
<!-- Bugs to fix -->
`;

const DEFAULT_HANDOFF = `# Handoff Artifact

No previous session found. This is the first session.

## Starting fresh
- Read CLAUDE.md to understand the project
- Check the feature list for priorities
- Begin with the most important TODO item
`;

export class ContextManager {
  constructor(
    private projectRoot: string,
    private config: HarnessConfig
  ) {}

  async loadContext(): Promise<ContextBundle> {
    const projectFile = resolve(
      this.projectRoot,
      this.config.context.project_file
    );
    const agentsFile = resolve(this.projectRoot, "AGENTS.md");
    const featureListFile = resolve(
      this.projectRoot,
      this.config.context.feature_list
    );
    const handoffFile = resolve(
      this.projectRoot,
      this.config.context.handoff
    );
    const sessionFile = resolve(
      this.projectRoot,
      this.config.context.session_state
    );

    let projectInstructions = readFileOrDefault(projectFile);
    if (!projectInstructions && existsSync(agentsFile)) {
      projectInstructions = readFileOrDefault(agentsFile);
    }
    if (!projectInstructions) {
      projectInstructions = DEFAULT_CLAUDE_MD;
    }

    const featureList = readFileOrDefault(featureListFile, DEFAULT_FEATURE_LIST);
    const handoff = readFileOrDefault(handoffFile, DEFAULT_HANDOFF);

    let sessionSummary = "No previous session.";
    const sessionRaw = readFileOrDefault(sessionFile);
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw) as SessionState;
        sessionSummary = this.formatSessionSummary(session);
      } catch (err) {
        process.stderr.write(`[harness] Failed to parse session.json: ${String(err)}\n`);
        sessionSummary = "Previous session state could not be parsed.";
      }
    }

    const totalTokensEstimate =
      estimateTokens(projectInstructions) +
      estimateTokens(featureList) +
      estimateTokens(handoff) +
      estimateTokens(sessionSummary);

    return {
      projectInstructions,
      sessionSummary,
      featureList,
      handoff,
      totalTokensEstimate,
    };
  }

  private formatSessionSummary(session: SessionState): string {
    const lines = [
      `Last session: ${session.sessionId}`,
      `Task: ${session.task}`,
      `Status: ${session.status}`,
    ];

    if (session.progress.filesChanged.length > 0) {
      lines.push(`Files changed: ${session.progress.filesChanged.join(", ")}`);
    }
    if (session.progress.testsFailing > 0) {
      lines.push(
        `Tests: ${session.progress.testsPassing} passing, ${session.progress.testsFailing} failing`
      );
    }
    if (session.nextSession.suggestedTask) {
      lines.push(`Suggested next: ${session.nextSession.suggestedTask}`);
    }
    if (session.nextSession.blockers.length > 0) {
      lines.push(`Blockers: ${session.nextSession.blockers.join(", ")}`);
    }

    return lines.join("\n");
  }

  async saveSession(state: SessionState): Promise<void> {
    const sessionFile = resolve(
      this.projectRoot,
      this.config.context.session_state
    );
    writeFileSafe(sessionFile, JSON.stringify(state, null, 2));
  }

  async createHandoffArtifact(state: SessionState): Promise<void> {
    const handoffFile = resolve(
      this.projectRoot,
      this.config.context.handoff
    );

    const handoff = `# Handoff Artifact — ${state.sessionId}

Generated: ${formatTimestamp()}

## Done in this session
Task: ${state.task}
Status: ${state.status}

### Files changed
${state.progress.filesChanged.length > 0
  ? state.progress.filesChanged.map((f) => `- ${f}`).join("\n")
  : "- No files recorded"}

### Test status
- Passing: ${state.progress.testsPassing}
- Failing: ${state.progress.testsFailing}

## Next session should
${state.nextSession.suggestedTask || "Continue from where this session left off."}

### Blockers
${state.nextSession.blockers.length > 0
  ? state.nextSession.blockers.map((b) => `- ${b}`).join("\n")
  : "- No blockers"}

### Critical files to check
${state.nextSession.criticalFiles.length > 0
  ? state.nextSession.criticalFiles.map((f) => `- ${f}`).join("\n")
  : "- None"}

## Token usage
- Input: ${state.tokenUsage.inputTokens}
- Output: ${state.tokenUsage.outputTokens}
- Total: ${state.tokenUsage.totalTokens}
`;

    writeFileSafe(handoffFile, handoff);
  }

  createInitialSession(task: string, backend: string, model?: string): SessionState {
    return {
      sessionId: generateSessionId(),
      startedAt: formatTimestamp(),
      backend,
      model,
      task,
      status: "RUNNING",
      progress: {
        filesChanged: [],
        testsAdded: 0,
        testsPassing: 0,
        testsFailing: 0,
      },
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      nextSession: {
        suggestedTask: undefined,
        blockers: [],
        criticalFiles: [],
      },
    };
  }

  initProjectFiles(): void {
    const claudeMdPath = resolve(
      this.projectRoot,
      this.config.context.project_file
    );
    if (!existsSync(claudeMdPath)) {
      writeFileSafe(claudeMdPath, DEFAULT_CLAUDE_MD);
    }

    const featureListPath = resolve(
      this.projectRoot,
      this.config.context.feature_list
    );
    if (!existsSync(featureListPath)) {
      writeFileSafe(featureListPath, DEFAULT_FEATURE_LIST);
    }

    const handoffPath = resolve(
      this.projectRoot,
      this.config.context.handoff
    );
    if (!existsSync(handoffPath)) {
      writeFileSafe(handoffPath, DEFAULT_HANDOFF);
    }
  }
}
