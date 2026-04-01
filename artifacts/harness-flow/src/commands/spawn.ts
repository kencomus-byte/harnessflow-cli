import chalk from "chalk";
import { resolve } from "path";
import { loadConfig } from "../config.js";
import { createAdapter } from "../adapters/factory.js";
import { SessionRunner } from "../session/runner.js";
import { SessionState } from "../types.js";
import { ensureDir } from "../utils.js";

interface SpawnOptions {
  backend?: string;
  parallel?: boolean;
  verbose?: boolean;
  json?: boolean;
}

interface SpawnResult {
  task: string;
  status: string;
  sessionId: string;
  durationMs: number;
  totalTokens: number;
  filesChanged: number;
  error?: string;
}

export async function spawnCommand(
  tasks: string[],
  projectRoot: string,
  options: SpawnOptions
): Promise<void> {
  if (tasks.length === 0) {
    console.error(chalk.red("❌ No tasks provided. Usage: harness spawn \"task1\" \"task2\""));
    process.exitCode = 1;
    return;
  }

  const config = loadConfig(projectRoot);
  if (options.backend) {
    (config as { backend: string }).backend = options.backend as "claude" | "codex" | "dry-run";
  }

  const parallel = options.parallel ?? false;

  console.log(chalk.cyan(`\n🚀 HarnessFlow Spawn — ${tasks.length} task(s) ${parallel ? "(parallel)" : "(sequential)"}\n`));
  for (let i = 0; i < tasks.length; i++) {
    console.log(chalk.gray(`  ${i + 1}. ${tasks[i].slice(0, 80)}`));
  }
  console.log();

  const spawnDir = resolve(projectRoot, ".harness", "spawn");
  ensureDir(spawnDir);

  const runTask = async (task: string, index: number): Promise<SpawnResult> => {
    const taskRoot = resolve(spawnDir, `task-${index + 1}`);
    ensureDir(taskRoot);

    const startMs = Date.now();

    try {
      const taskConfig = {
        ...config,
        context: {
          ...config.context,
          session_state: `.harness/spawn/task-${index + 1}/session.json`,
          handoff: `.harness/spawn/task-${index + 1}/handoff.md`,
        },
        observability: {
          ...config.observability,
          trace_dir: `.harness/spawn/task-${index + 1}/traces`,
          eval_dir: `.harness/spawn/task-${index + 1}/evals`,
          token_log: `.harness/spawn/task-${index + 1}/token_usage.jsonl`,
        },
      };

      ensureDir(resolve(projectRoot, taskConfig.observability.trace_dir));

      const adapter = await createAdapter(taskConfig);
      const runner = new SessionRunner(projectRoot, taskConfig);

      if (!parallel && !options.verbose) {
        process.stdout.write(chalk.gray(`  [${index + 1}/${tasks.length}] Running: ${task.slice(0, 60)}...`));
      }

      const session: SessionState = await runner.run(task, adapter, options.verbose ?? false);

      if (!parallel && !options.verbose) {
        const icon = session.status === "COMPLETED" ? chalk.green("✓") : chalk.red("✗");
        process.stdout.write(` ${icon} ${session.status}\n`);
      }

      return {
        task,
        status: session.status,
        sessionId: session.sessionId,
        durationMs: Date.now() - startMs,
        totalTokens: session.tokenUsage.totalTokens,
        filesChanged: session.progress.filesChanged.length,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!parallel && !options.verbose) {
        process.stdout.write(` ${chalk.red("✗")} ERROR\n`);
      }
      return {
        task,
        status: "FAILED",
        sessionId: `task-${index + 1}`,
        durationMs: Date.now() - startMs,
        totalTokens: 0,
        filesChanged: 0,
        error: msg,
      };
    }
  };

  let results: SpawnResult[];

  if (parallel) {
    results = await Promise.all(tasks.map((task, i) => runTask(task, i)));
  } else {
    results = [];
    for (let i = 0; i < tasks.length; i++) {
      results.push(await runTask(tasks[i], i));
    }
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);
  const passed = results.filter((r) => r.status === "COMPLETED").length;
  const failed = results.filter((r) => r.status !== "COMPLETED").length;

  console.log(chalk.cyan(`\n📊 Spawn Results\n`));
  console.log(`  ${"#".padEnd(3)} ${"Status".padEnd(12)} ${"Tokens".padEnd(8)} ${"Files".padEnd(6)} Task`);
  console.log("  " + "─".repeat(70));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const statusColor = r.status === "COMPLETED"
      ? chalk.green
      : r.status === "INTERRUPTED"
        ? chalk.yellow
        : chalk.red;

    const num = String(i + 1).padEnd(3);
    const status = statusColor(r.status.padEnd(12));
    const tokens = String(r.totalTokens).padEnd(8);
    const files = String(r.filesChanged).padEnd(6);
    const task = r.task.slice(0, 40) + (r.task.length > 40 ? "..." : "");
    console.log(`  ${num} ${status} ${tokens} ${files} ${task}`);

    if (r.error) {
      console.log(chalk.red(`       Error: ${r.error.slice(0, 80)}`));
    }
  }

  console.log("  " + "─".repeat(70));
  console.log(
    `\n  ${chalk.green(`${passed} completed`)}, ${failed > 0 ? chalk.red(`${failed} failed`) : chalk.gray("0 failed")}` +
    chalk.gray(` — total tokens: ${totalTokens}\n`)
  );

  console.log(chalk.gray(`  Session data saved to: .harness/spawn/\n`));

  if (failed > 0) {
    process.exitCode = 1;
  }
}
