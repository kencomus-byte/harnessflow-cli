import chalk from "chalk";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { resolve, basename } from "path";
import { loadConfig } from "../config.js";
import { SessionState, TraceEvent } from "../types.js";
import { formatTokenCount, formatCost } from "../utils.js";

interface StatusOptions {
  traces?: boolean;
  tokens?: boolean;
  json?: boolean;
}

export async function statusCommand(
  projectRoot: string,
  options: StatusOptions
): Promise<void> {
  const config = loadConfig(projectRoot);
  const sessionFile = resolve(projectRoot, config.context.session_state);
  const traceDir = resolve(projectRoot, config.observability.trace_dir);
  const tokenLogFile = resolve(projectRoot, config.observability.token_log);

  if (options.json) {
    const output: Record<string, unknown> = {};

    if (existsSync(sessionFile)) {
      try {
        output.session = JSON.parse(readFileSync(sessionFile, "utf8"));
      } catch {
        output.session = null;
      }
    }

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(chalk.cyan("\n📊 HarnessFlow Status\n"));

  if (!existsSync(sessionFile)) {
    console.log(chalk.gray("  No session found. Run `harness run \"task\"` to start."));
  } else {
    try {
      const session = JSON.parse(readFileSync(sessionFile, "utf8")) as SessionState;
      printSession(session);
    } catch {
      console.log(chalk.red("  ⚠️  Could not parse session.json"));
    }
  }

  if (options.tokens && existsSync(tokenLogFile)) {
    console.log(chalk.cyan("\n💰 Token Usage History\n"));
    printTokenHistory(tokenLogFile);
  }

  if (options.traces && existsSync(traceDir)) {
    console.log(chalk.cyan("\n🔍 Recent Traces\n"));
    printTraces(traceDir);
  }

  const configExists = existsSync(resolve(projectRoot, ".harness.yaml"));
  const claudeMdExists = existsSync(resolve(projectRoot, config.context.project_file));

  console.log(chalk.cyan("\n📁 Project Files\n"));
  console.log(`  ${configExists ? "✓" : "✗"} .harness.yaml`);
  console.log(`  ${claudeMdExists ? "✓" : "✗"} ${config.context.project_file}`);
  console.log(
    `  ${existsSync(resolve(projectRoot, config.context.feature_list)) ? "✓" : "✗"} ${config.context.feature_list}`
  );
  console.log(
    `  ${existsSync(resolve(projectRoot, config.context.handoff)) ? "✓" : "✗"} ${config.context.handoff}`
  );
  console.log();
}

function printSession(session: SessionState): void {
  const statusColor =
    session.status === "COMPLETED"
      ? chalk.green
      : session.status === "FAILED"
        ? chalk.red
        : chalk.yellow;

  console.log(chalk.bold("  Last Session"));
  console.log(`  ID:      ${session.sessionId}`);
  console.log(`  Task:    ${session.task.slice(0, 80)}`);
  console.log(`  Status:  ${statusColor(session.status)}`);
  console.log(`  Backend: ${session.backend}${session.model ? ` / ${session.model}` : ""}`);
  console.log(`  Started: ${session.startedAt}`);
  if (session.endedAt) console.log(`  Ended:   ${session.endedAt}`);

  if (session.progress.filesChanged.length > 0) {
    console.log(`\n  Files Changed (${session.progress.filesChanged.length}):`);
    for (const f of session.progress.filesChanged.slice(0, 10)) {
      console.log(`    - ${f}`);
    }
  }

  const { inputTokens, outputTokens, totalTokens } = session.tokenUsage;
  if (totalTokens > 0) {
    console.log(
      `\n  Tokens: in=${formatTokenCount(inputTokens)} out=${formatTokenCount(outputTokens)} total=${formatTokenCount(totalTokens)} cost≈${formatCost(totalTokens)}`
    );
  }

  if (session.nextSession.suggestedTask) {
    console.log(`\n  Suggested next: ${session.nextSession.suggestedTask}`);
  }
}

function printTokenHistory(tokenLogFile: string): void {
  try {
    const lines = readFileSync(tokenLogFile, "utf8").trim().split("\n").filter(Boolean);
    const recent = lines.slice(-10);
    let totalTokens = 0;

    for (const line of recent) {
      try {
        const entry = JSON.parse(line) as { ts: string; sessionId: string; totalTokens: number };
        console.log(
          `  ${entry.ts.slice(0, 16)} | ${entry.sessionId.slice(0, 25)} | ${formatTokenCount(entry.totalTokens)} tokens`
        );
        totalTokens += entry.totalTokens;
      } catch {
        }
    }

    if (lines.length > 0) {
      const allTokens = lines.reduce((sum, l) => {
        try { return sum + (JSON.parse(l) as { totalTokens: number }).totalTokens; } catch { return sum; }
      }, 0);
      console.log(chalk.gray(`\n  Total across all sessions: ${formatTokenCount(allTokens)} tokens ≈ ${formatCost(allTokens)}`));
    }
  } catch {
    console.log(chalk.gray("  No token history yet."));
  }
}

function printTraces(traceDir: string): void {
  try {
    const files = readdirSync(traceDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ name: f, mtime: statSync(resolve(traceDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5);

    for (const file of files) {
      console.log(`  ${file.name}`);
    }
  } catch {
    console.log(chalk.gray("  No traces yet."));
  }
}
