import { Command } from "commander";
import chalk from "chalk";
import { findProjectRoot } from "./utils.js";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { resumeCommand } from "./commands/resume.js";
import { statusCommand } from "./commands/status.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("harness")
    .description(
      "HarnessFlow CLI — A harness layer between you and AI coding agents"
    )
    .version(VERSION, "-v, --version");

  program
    .command("init")
    .description("Initialize HarnessFlow in the current project")
    .option("--backend <backend>", "Default AI backend (claude|codex|dry-run)", "claude")
    .option("--force", "Overwrite existing .harness.yaml")
    .action(async (options: { backend?: string; force?: boolean }) => {
      const projectRoot = findProjectRoot();
      await initCommand(projectRoot, options);
    });

  program
    .command("run <task>")
    .description("Run an AI agent session with the given task")
    .option("--backend <backend>", "AI backend to use (claude|codex|dry-run)")
    .option("--model <model>", "Model to use (e.g. claude-opus-4-5)")
    .option("--verbose", "Show thinking and tool results verbosely")
    .option("--dry-run", "Simulate agent without calling actual CLI")
    .action(
      async (
        task: string,
        options: {
          backend?: string;
          model?: string;
          verbose?: boolean;
          dryRun?: boolean;
        }
      ) => {
        const projectRoot = findProjectRoot();
        await runCommand(task, projectRoot, options);
      }
    );

  program
    .command("resume [sessionId]")
    .description("Resume the last session (or a specific session by ID)")
    .option("--backend <backend>", "AI backend to use")
    .option("--verbose", "Show thinking and tool results verbosely")
    .action(
      async (
        sessionId: string | undefined,
        options: { backend?: string; verbose?: boolean }
      ) => {
        const projectRoot = findProjectRoot();
        await resumeCommand(sessionId, projectRoot, options);
      }
    );

  program
    .command("status")
    .description("Show current session and project state")
    .option("--traces", "Show recent trace files")
    .option("--tokens", "Show token usage history")
    .option("--json", "Output as JSON")
    .action(
      async (options: { traces?: boolean; tokens?: boolean; json?: boolean }) => {
        const projectRoot = findProjectRoot();
        await statusCommand(projectRoot, options);
      }
    );

  program.on("command:*", () => {
    console.error(chalk.red(`Unknown command: ${program.args.join(" ")}`));
    console.log(chalk.gray("Run `harness --help` for usage."));
    process.exit(1);
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\n❌ Error: ${msg}`));
    process.exit(1);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`\nFatal: ${msg}`));
  process.exit(1);
});
