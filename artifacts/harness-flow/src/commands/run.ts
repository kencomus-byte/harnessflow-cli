import chalk from "chalk";
import { loadConfig } from "../config.js";
import { createAdapter } from "../adapters/factory.js";
import { SessionRunner } from "../session/runner.js";

interface RunOptions {
  backend?: string;
  model?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

export async function runCommand(
  task: string,
  projectRoot: string,
  options: RunOptions
): Promise<void> {
  const config = loadConfig(projectRoot);

  if (options.backend) {
    (config as { backend: string }).backend = options.backend as "claude" | "codex" | "dry-run";
  }
  if (options.dryRun) {
    (config as { backend: string }).backend = "dry-run";
  }
  if (options.model) {
    config.model = options.model;
  }

  console.log(chalk.cyan(`\n🤖 HarnessFlow — Starting session`));
  console.log(chalk.gray(`   Task: ${task.slice(0, 100)}${task.length > 100 ? "..." : ""}`));

  const adapter = await createAdapter(config);
  const runner = new SessionRunner(projectRoot, config);

  const session = await runner.run(task, adapter, options.verbose ?? false);

  if (session.status === "FAILED") {
    process.exitCode = 1;
  }
}
