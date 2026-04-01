import chalk from "chalk";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { loadConfig } from "../config.js";
import { createAdapter } from "../adapters/factory.js";
import { SessionRunner } from "../session/runner.js";
import { SessionState } from "../types.js";

interface ResumeOptions {
  backend?: string;
  verbose?: boolean;
}

export async function resumeCommand(
  sessionId: string | undefined,
  projectRoot: string,
  options: ResumeOptions
): Promise<void> {
  const config = loadConfig(projectRoot);

  if (options.backend) {
    (config as { backend: string }).backend = options.backend as "claude" | "codex" | "dry-run";
  }

  let resolvedSessionId = sessionId;

  if (!resolvedSessionId) {
    const sessionFile = resolve(projectRoot, config.context.session_state);
    if (!existsSync(sessionFile)) {
      console.error(
        chalk.red("❌ No session to resume. No .harness/session.json found.")
      );
      console.log(chalk.gray(`   Run: harness run "your task" to start a new session`));
      process.exit(1);
    }

    try {
      const raw = readFileSync(sessionFile, "utf8");
      const session = JSON.parse(raw) as SessionState;
      resolvedSessionId = session.sessionId;
      console.log(
        chalk.cyan(`   Found session: ${resolvedSessionId} (${session.status})`)
      );
    } catch {
      console.error(chalk.red("❌ Failed to read session file."));
      process.exit(1);
    }
  }

  const adapter = await createAdapter(config);
  const runner = new SessionRunner(projectRoot, config);

  const session = await runner.resume(resolvedSessionId, adapter, options.verbose ?? false);

  if (session.status === "FAILED" || session.status === "INTERRUPTED") {
    process.exitCode = 1;
  }
}
