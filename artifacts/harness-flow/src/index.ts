import { Command } from "commander";
import chalk from "chalk";
import { findProjectRoot } from "./utils.js";
import { initCommand } from "./commands/init.js";
import { runCommand } from "./commands/run.js";
import { resumeCommand } from "./commands/resume.js";
import { statusCommand } from "./commands/status.js";
import { evalCommand } from "./commands/eval.js";
import { replayCommand } from "./commands/replay.js";
import { generateClaudeCommand } from "./commands/generate-claude.js";
import { checkCommand } from "./commands/check.js";
import { spawnCommand } from "./commands/spawn.js";
import { pluginListCommand, pluginScaffoldCommand } from "./commands/plugin.js";

const VERSION = "0.2.0";

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

  program
    .command("replay [sessionId]")
    .description("Replay a session trace for debugging and audit")
    .option("--speed <n>", "Playback speed multiplier (default: 1.0)", parseFloat)
    .option("--filter <type>", "Only show events of this type (e.g. tool_call, guardrail_block)")
    .option("--json", "Output all events as JSON")
    .action(
      async (
        sessionId: string | undefined,
        options: { speed?: number; filter?: string; json?: boolean }
      ) => {
        const projectRoot = findProjectRoot();
        await replayCommand(sessionId, projectRoot, options);
      }
    );

  program
    .command("eval [sessionId]")
    .description("Analyze a session trace and produce an eval report")
    .option("--all", "Evaluate all trace files")
    .option("--json", "Output eval report as JSON")
    .action(
      async (
        sessionId: string | undefined,
        options: { all?: boolean; json?: boolean }
      ) => {
        const projectRoot = findProjectRoot();
        await evalCommand(projectRoot, { sessionId, ...options });
      }
    );

  program
    .command("generate-claude")
    .description("Generate or update CLAUDE.md from .harness.yaml config")
    .option("--force", "Overwrite existing CLAUDE.md")
    .option("--project-name <name>", "Override the project name in the generated file")
    .option("--output <path>", "Output path (default: CLAUDE.md from config)")
    .action(
      async (options: { force?: boolean; projectName?: string; output?: string }) => {
        const projectRoot = findProjectRoot();
        await generateClaudeCommand(projectRoot, options);
      }
    );

  program
    .command("check")
    .description("Run quality gates defined in .harness.yaml")
    .option("--verbose", "Show full output of each gate")
    .option("--json", "Output results as JSON")
    .option("--gate <name>", "Only run gates matching this name or command substring")
    .action(
      async (options: { verbose?: boolean; json?: boolean; gate?: string }) => {
        const projectRoot = findProjectRoot();
        await checkCommand(projectRoot, options);
      }
    );

  program
    .command("spawn <tasks...>")
    .description("Spawn multiple agent sessions for different tasks")
    .option("--parallel", "Run all tasks in parallel (default: sequential)")
    .option("--backend <backend>", "AI backend to use for all tasks")
    .option("--verbose", "Show agent output for each task")
    .option("--json", "Output results as JSON")
    .action(
      async (
        tasks: string[],
        options: { parallel?: boolean; backend?: string; verbose?: boolean; json?: boolean }
      ) => {
        const projectRoot = findProjectRoot();
        await spawnCommand(tasks, projectRoot, options);
      }
    );

  const pluginCmd = program
    .command("plugin")
    .description("Manage HarnessFlow plugins");

  pluginCmd
    .command("list")
    .description("List installed plugins in .harness/plugins/")
    .option("--json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const projectRoot = findProjectRoot();
      await pluginListCommand(projectRoot, options);
    });

  pluginCmd
    .command("scaffold <name>")
    .description("Create a starter plugin file in .harness/plugins/")
    .action(async (name: string) => {
      const projectRoot = findProjectRoot();
      await pluginScaffoldCommand(name, projectRoot);
    });

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
