import chalk from "chalk";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadConfig } from "../config.js";
import { ensureDir, formatTimestamp } from "../utils.js";

interface EvalOptions {
  sessionId?: string;
  all?: boolean;
  json?: boolean;
}

interface TraceEvent {
  ts: string;
  type: string;
  [key: string]: unknown;
}

interface EvalReport {
  sessionId: string;
  generatedAt: string;
  traceFile: string;
  totalEvents: number;
  eventBreakdown: Record<string, number>;
  toolCalls: {
    total: number;
    byTool: Record<string, number>;
    blockedByGuardrail: number;
  };
  guardrailEvents: {
    total: number;
    denied: number;
    confirmed: number;
    warned: number;
  };
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  sessionDuration: string | null;
  filesChanged: number;
  sessionStatus: string | null;
  issues: string[];
}

export async function evalCommand(
  projectRoot: string,
  options: EvalOptions
): Promise<void> {
  const config = loadConfig(projectRoot);
  const traceDir = resolve(projectRoot, config.observability.trace_dir);
  const evalDir = resolve(projectRoot, config.observability.eval_dir);

  if (!existsSync(traceDir)) {
    console.error(chalk.red("❌ No traces found. Run `harness run` first."));
    process.exit(1);
  }

  const traceFiles = readdirSync(traceDir).filter((f) => f.endsWith(".jsonl"));
  if (traceFiles.length === 0) {
    console.error(chalk.red("❌ No trace files found in " + traceDir));
    process.exit(1);
  }

  let filesToEval: string[] = [];

  if (options.all) {
    filesToEval = traceFiles;
  } else if (options.sessionId) {
    const match = `${options.sessionId}.jsonl`;
    if (!traceFiles.includes(match)) {
      console.error(chalk.red(`❌ Trace not found for session: ${options.sessionId}`));
      process.exit(1);
    }
    filesToEval = [match];
  } else {
    filesToEval = [traceFiles[traceFiles.length - 1]];
  }

  ensureDir(evalDir);

  const reports: EvalReport[] = [];

  for (const traceFileName of filesToEval) {
    const traceFile = resolve(traceDir, traceFileName);
    const sessionId = traceFileName.replace(".jsonl", "");
    const report = analyzeTrace(sessionId, traceFile);
    reports.push(report);

    const evalFile = resolve(evalDir, `${sessionId}.eval.json`);
    writeFileSync(evalFile, JSON.stringify(report, null, 2), "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
    return;
  }

  for (const report of reports) {
    printReport(report);
  }

  console.log(chalk.gray(`\n📁 Eval reports saved to: ${evalDir}\n`));
}

function analyzeTrace(sessionId: string, traceFile: string): EvalReport {
  const lines = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);

  const events: TraceEvent[] = [];
  const parseErrors: string[] = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as TraceEvent);
    } catch {
      parseErrors.push(`Failed to parse trace line: ${line.slice(0, 80)}`);
    }
  }

  const eventBreakdown: Record<string, number> = {};
  const toolCallsByTool: Record<string, number> = {};
  let totalToolCalls = 0;
  let blockedByGuardrail = 0;
  let guardrailDenied = 0;
  let guardrailConfirmed = 0;
  let guardrailWarned = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let sessionStatus: string | null = null;
  let filesChanged = 0;
  const issues: string[] = [...parseErrors];

  for (const event of events) {
    eventBreakdown[event.type] = (eventBreakdown[event.type] ?? 0) + 1;

    if (event.type === "tool_call") {
      totalToolCalls++;
      const tool = (event.tool as string) ?? "unknown";
      toolCallsByTool[tool] = (toolCallsByTool[tool] ?? 0) + 1;
    }

    if (event.type === "guardrail_block") {
      const action = event.action as string;
      if (action === "deny") {
        guardrailDenied++;
        blockedByGuardrail++;
      } else if (action === "confirm") {
        guardrailConfirmed++;
      } else if (action === "warn") {
        guardrailWarned++;
      }
    }

    if (event.type === "token_usage") {
      inputTokens = (event.inputTokens as number) ?? 0;
      outputTokens = (event.outputTokens as number) ?? 0;
      totalTokens = (event.totalTokens as number) ?? 0;
    }

    if (event.type === "session_end") {
      sessionStatus = (event.status as string) ?? null;
      filesChanged = (event.filesChanged as number) ?? 0;

      if (sessionStatus === "FAILED") {
        issues.push("Session ended with FAILED status");
      }
    }
  }

  let sessionDuration: string | null = null;
  const startEvent = events.find((e) => e.type === "session_start");
  const endEvent = events.find((e) => e.type === "session_end");
  if (startEvent?.ts && endEvent?.ts) {
    const startMs = new Date(startEvent.ts as string).getTime();
    const endMs = new Date(endEvent.ts as string).getTime();
    const durationSec = Math.round((endMs - startMs) / 1000);
    sessionDuration = `${durationSec}s`;
  }

  if (guardrailDenied > 0) {
    issues.push(`${guardrailDenied} command(s) blocked by guardrails`);
  }

  return {
    sessionId,
    generatedAt: formatTimestamp(),
    traceFile,
    totalEvents: events.length,
    eventBreakdown,
    toolCalls: {
      total: totalToolCalls,
      byTool: toolCallsByTool,
      blockedByGuardrail,
    },
    guardrailEvents: {
      total: guardrailDenied + guardrailConfirmed + guardrailWarned,
      denied: guardrailDenied,
      confirmed: guardrailConfirmed,
      warned: guardrailWarned,
    },
    tokenUsage: { inputTokens, outputTokens, totalTokens },
    sessionDuration,
    filesChanged,
    sessionStatus,
    issues,
  };
}

function printReport(report: EvalReport): void {
  const statusColor = report.sessionStatus === "COMPLETED"
    ? chalk.green
    : report.sessionStatus === "FAILED"
      ? chalk.red
      : chalk.yellow;

  console.log(chalk.cyan(`\n📊 Eval Report: ${report.sessionId}\n`));
  console.log(`  Status:         ${statusColor(report.sessionStatus ?? "unknown")}`);
  console.log(`  Duration:       ${report.sessionDuration ?? "unknown"}`);
  console.log(`  Total Events:   ${report.totalEvents}`);
  console.log(`  Tool Calls:     ${report.toolCalls.total}`);
  console.log(`  Files Changed:  ${report.filesChanged}`);

  if (Object.keys(report.toolCalls.byTool).length > 0) {
    console.log("\n  Tool Breakdown:");
    for (const [tool, count] of Object.entries(report.toolCalls.byTool)) {
      console.log(`    ${tool}: ${count}`);
    }
  }

  if (report.guardrailEvents.total > 0) {
    console.log(`\n  Guardrail Events: ${report.guardrailEvents.total}`);
    if (report.guardrailEvents.denied > 0)    console.log(`    Denied:    ${report.guardrailEvents.denied}`);
    if (report.guardrailEvents.confirmed > 0) console.log(`    Confirmed: ${report.guardrailEvents.confirmed}`);
    if (report.guardrailEvents.warned > 0)    console.log(`    Warned:    ${report.guardrailEvents.warned}`);
  }

  const { inputTokens, outputTokens, totalTokens } = report.tokenUsage;
  if (totalTokens > 0) {
    console.log(`\n  Tokens:   in=${inputTokens} out=${outputTokens} total=${totalTokens}`);
  }

  if (report.issues.length > 0) {
    console.log(chalk.yellow(`\n  ⚠️  Issues (${report.issues.length}):`));
    for (const issue of report.issues) {
      console.log(chalk.yellow(`    - ${issue}`));
    }
  } else {
    console.log(chalk.green("\n  ✓ No issues detected"));
  }
}
