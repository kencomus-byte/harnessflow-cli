import chalk from "chalk";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadConfig } from "../config.js";
import { PluginLoader } from "../plugins/loader.js";
import { ensureDir } from "../utils.js";

interface PluginOptions {
  json?: boolean;
}

export async function pluginListCommand(
  projectRoot: string,
  options: PluginOptions
): Promise<void> {
  const config = loadConfig(projectRoot);
  const loader = new PluginLoader(projectRoot, config);
  const loaded = await loader.load();

  if (options.json) {
    console.log(
      JSON.stringify(
        loaded.map((l) => ({
          name: l.plugin.name,
          version: l.plugin.version,
          description: l.plugin.description,
          file: l.filePath,
          status: l.loadError ? "error" : "ok",
          error: l.loadError,
        })),
        null,
        2
      )
    );
    return;
  }

  const pluginDir = resolve(projectRoot, config.plugins.dir);

  console.log(chalk.cyan(`\n🔌 HarnessFlow Plugins`));
  console.log(chalk.gray(`   Directory: ${pluginDir}\n`));

  if (loaded.length === 0) {
    console.log(chalk.gray("   No plugins found.\n"));
    console.log(`   Add plugin files (*.mjs) to: ${pluginDir}`);
    console.log(`   Run "harness plugin scaffold <name>" to create a starter plugin.\n`);
    return;
  }

  for (const l of loaded) {
    const status = l.loadError
      ? chalk.red("✗ ERROR")
      : chalk.green("✓ OK   ");
    const version = chalk.gray(`v${l.plugin.version}`);
    console.log(`  ${status}  ${l.plugin.name} ${version}`);
    if (l.plugin.description) {
      console.log(chalk.gray(`         ${l.plugin.description}`));
    }
    if (l.loadError) {
      console.log(chalk.red(`         Error: ${l.loadError}`));
    }
  }
  console.log();
}

export async function pluginScaffoldCommand(
  pluginName: string,
  projectRoot: string
): Promise<void> {
  const config = loadConfig(projectRoot);
  const pluginDir = resolve(projectRoot, config.plugins.dir);

  ensureDir(pluginDir);

  const safeName = pluginName.replace(/[^a-zA-Z0-9-_]/g, "-");
  const filePath = resolve(pluginDir, `${safeName}.mjs`);

  if (existsSync(filePath)) {
    console.log(chalk.yellow(`⚠️  Plugin already exists: ${filePath}`));
    return;
  }

  const scaffold = `/**
 * HarnessFlow Plugin: ${pluginName}
 *
 * Add this file to .harness/plugins/ to activate.
 * Restart HarnessFlow for changes to take effect.
 */

/** @type {import('@workspace/harness-flow').HarnessPlugin} */
const plugin = {
  name: "${safeName}",
  version: "0.1.0",
  description: "My custom HarnessFlow plugin",

  /**
   * Called for every agent event (tool_call, tool_result, message, etc.)
   * @param {object} event
   */
  async onEvent(event) {
    // Example: log all tool calls
    if (event.type === "tool_call") {
      console.log(\`[${safeName}] Tool called: \${event.tool}\`);
    }
  },

  /**
   * Optional: declare additional hooks (must also create the companion .sh scripts)
   * hooks: {
   *   pre_tool: [{ name: "my-check", on_tools: ["Bash"], blocking: true, timeout: 30 }],
   *   post_tool: [{ name: "my-post", blocking: false, timeout: 60 }],
   *   on_session_end: [{ name: "my-end", blocking: false, timeout: 60 }],
   * },
   */
};

export default plugin;
`;

  writeFileSync(filePath, scaffold, "utf8");
  console.log(chalk.green(`\n✅ Plugin scaffolded: ${filePath}\n`));
  console.log(chalk.gray("   Edit it, then restart HarnessFlow to activate.\n"));
}
