import chalk from "chalk";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { loadConfig } from "../config.js";

interface ReplayOptions {
  speed?: number;
  filter?: string;
  json?: boolean;
}

interface TraceEventEntry {
  ts: string;
  type: string;
  [key: string]: unknown;
}

export async function replayCommand(
  sessionId: string | undefined,
  projectRoot: string,
  options: ReplayOptions
): Promise<void> {
  const config = loadConfig(projectRoot);
  const traceDir = resolve(projectRoot, config.observability.trace_dir);

  if (!existsSync(traceDir)) {
    console.error(chalk.red("❌ No traces directory found. Run `harness run` first."));
    process.exit(1);
  }

  const traceFiles = readdirSync(traceDir).filter((f) => f.endsWith(".jsonl"));
  if (traceFiles.length === 0) {
    console.error(chalk.red("❌ No trace files found."));
    process.exit(1);
  }

  let traceFile: string;
  let resolvedSessionId: string;

  if (sessionId) {
    const filename = `${sessionId}.jsonl`;
    if (!traceFiles.includes(filename)) {
      console.error(chalk.red(`❌ No trace found for session: ${sessionId}`));
      process.exit(1);
    }
    traceFile = resolve(traceDir, filename);
    resolvedSessionId = sessionId;
  } else {
    const latest = traceFiles[traceFiles.length - 1];
    traceFile = resolve(traceDir, latest);
    resolvedSessionId = latest.replace(".jsonl", "");
  }

  const rawLines = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);
  const events: TraceEventEntry[] = [];
  const parseErrors: string[] = [];

  for (const line of rawLines) {
    try {
      events.push(JSON.parse(line) as TraceEventEntry);
    } catch {
      parseErrors.push(line.slice(0, 80));
    }
  }

  if (parseErrors.length > 0) {
    console.warn(chalk.yellow(`⚠️  ${parseErrors.length} unparseable line(s) skipped`));
  }

  const filtered = options.filter
    ? events.filter((e) => e.type === options.filter)
    : events;

  if (options.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  console.log(chalk.cyan(`\n🎬 Replaying session: ${resolvedSessionId}`));
  console.log(chalk.gray(`   Trace file: ${traceFile}`));
  console.log(chalk.gray(`   Events: ${filtered.length}${options.filter ? ` (filtered to type: ${options.filter})` : ""}\n`));

  const delayMs = options.speed !== undefined
    ? Math.max(0, Math.round(1000 / Math.max(0.1, options.speed)))
    : 100;

  for (const event of filtered) {
    printEvent(event);

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log(chalk.gray(`\n✓ Replay complete (${filtered.length} events)\n`));
}

function printEvent(event: TraceEventEntry): void {
  const ts = chalk.gray(`[${event.ts}]`);

  switch (event.type) {
    case "session_start":
      console.log(`${ts} ${chalk.cyan("SESSION START")} task=${JSON.stringify(event.task)} backend=${event.backend}`);
      break;

    case "context_load":
      console.log(`${ts} ${chalk.blue("CONTEXT LOAD")} tokens=${event.tokens} files=${JSON.stringify(event.files)}`);
      break;

    case "tool_call": {
      const argsStr = JSON.stringify(event.args ?? {}).slice(0, 100);
      console.log(`${ts} ${chalk.blue("TOOL CALL")} ${event.tool} ${chalk.gray(argsStr)}`);
      break;
    }

    case "guardrail_block":
      console.log(`${ts} ${chalk.yellow("GUARDRAIL")} action=${event.action} pattern=${String(event.pattern).slice(0, 80)}`);
      break;

    case "hook_run": {
      const status = Number(event.exitCode) === 0 ? chalk.green("ok") : chalk.red(`exit=${event.exitCode}`);
      console.log(`${ts} ${chalk.magenta("HOOK")} ${event.hook} [${event.trigger}] ${status} ${event.durationMs}ms`);
      break;
    }

    case "token_usage":
      console.log(`${ts} ${chalk.gray("TOKENS")} in=${event.inputTokens} out=${event.outputTokens} total=${event.totalTokens}`);
      break;

    case "session_end":
      console.log(`${ts} ${chalk.green("SESSION END")} status=${event.status} files=${event.filesChanged} tokens=${event.totalTokens}`);
      break;

    default:
      console.log(`${ts} ${chalk.gray(event.type)} ${JSON.stringify(omit(event, ["ts", "type"])).slice(0, 120)}`);
  }
}

function omit(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.includes(k)) result[k] = v;
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
