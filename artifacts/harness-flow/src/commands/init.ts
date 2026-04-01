import { existsSync, writeFileSync, appendFileSync, readFileSync } from "fs";
import { resolve } from "path";
import chalk from "chalk";
import { getDefaultConfigYaml, loadConfig } from "../config.js";
import { ContextManager } from "../context/manager.js";
import { ensureDir } from "../utils.js";

interface InitOptions {
  backend?: string;
  force?: boolean;
}

export async function initCommand(
  projectRoot: string,
  options: InitOptions
): Promise<void> {
  console.log(chalk.cyan("\n🚀 Initializing HarnessFlow project...\n"));

  const configPath = resolve(projectRoot, ".harness.yaml");
  const harnessDir = resolve(projectRoot, ".harness");

  if (existsSync(configPath) && !options.force) {
    console.log(
      chalk.yellow("⚠️  .harness.yaml already exists. Use --force to overwrite.")
    );
    return;
  }

  let configContent = getDefaultConfigYaml();
  if (options.backend) {
    configContent = configContent.replace(
      /^backend: claude/m,
      `backend: ${options.backend}`
    );
  }
  writeFileSync(configPath, configContent, "utf8");
  console.log(chalk.green("  ✓ Created .harness.yaml"));

  ensureDir(harnessDir);
  ensureDir(resolve(harnessDir, "traces"));
  ensureDir(resolve(harnessDir, "evals"));
  ensureDir(resolve(harnessDir, "prompts"));
  ensureDir(resolve(harnessDir, "plugins"));
  console.log(chalk.green("  ✓ Created .harness/ directory structure"));

  const config = loadConfig(projectRoot);
  const contextManager = new ContextManager(projectRoot, config);
  contextManager.initProjectFiles();
  console.log(chalk.green("  ✓ Created CLAUDE.md (if missing)"));
  console.log(chalk.green("  ✓ Created .harness/feature_list.md (if missing)"));
  console.log(chalk.green("  ✓ Created .harness/handoff.md (if missing)"));

  const gitignorePath = resolve(projectRoot, ".gitignore");
  const harnessIgnore =
    "\n# HarnessFlow\n.harness/session.json\n.harness/traces/\n.harness/token_usage.jsonl\n";
  if (existsSync(gitignorePath)) {
    const existing = readFileSync(gitignorePath, "utf8");
    if (!existing.includes(".harness/session.json")) {
      appendFileSync(gitignorePath, harnessIgnore, "utf8");
      console.log(chalk.green("  ✓ Updated .gitignore"));
    }
  }

  console.log(chalk.cyan("\n✅ HarnessFlow initialized!\n"));
  console.log("Next steps:");
  console.log(chalk.white("  1. Run: harness generate-claude  (auto-generate CLAUDE.md from config)"));
  console.log(chalk.white("  2. Edit CLAUDE.md to describe your project"));
  console.log(chalk.white("  3. Edit .harness/feature_list.md with your features"));
  console.log(chalk.white("  4. Run: harness run \"your task here\""));
  console.log(chalk.white("  5. Check traces:  harness status --traces"));
  console.log(chalk.white("  6. Run gates:     harness check"));
  console.log(chalk.white("  7. Add plugins:   harness plugin scaffold my-plugin\n"));
}
