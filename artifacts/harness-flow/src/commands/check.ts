import chalk from "chalk";
import { resolve } from "path";
import { loadConfig } from "../config.js";
import { QualityGateRunner } from "../quality/runner.js";

interface CheckOptions {
  verbose?: boolean;
  json?: boolean;
  gate?: string;
}

export async function checkCommand(
  projectRoot: string,
  options: CheckOptions
): Promise<void> {
  const config = loadConfig(projectRoot);

  if (config.quality_gates.length === 0) {
    console.log(chalk.yellow("\n⚠️  No quality gates configured.\n"));
    console.log("Add quality_gates to .harness.yaml, e.g.:\n");
    console.log(chalk.gray(`quality_gates:
  - name: Unit tests
    command: pnpm test
    on: session_end
    blocking: false
  - name: Typecheck
    command: pnpm typecheck
    on: always
    blocking: true
`));
    return;
  }

  const runner = new QualityGateRunner(
    resolve(projectRoot),
    options.gate
      ? {
          ...config,
          quality_gates: config.quality_gates.filter((g) =>
            g.name.toLowerCase().includes(options.gate!.toLowerCase()) ||
            g.command.includes(options.gate!)
          ),
        }
      : config
  );

  console.log(chalk.cyan(`\n🔬 HarnessFlow Quality Gates\n`));

  const results = await runner.runGates("always", options.verbose ?? false);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const failed = results.filter((r) => !r.passed);
  const blockingFailed = results.filter((r) => !r.passed && r.blocking);

  if (failed.length > 0 && options.verbose) {
    console.log(chalk.red("\n❌ Failed gates:\n"));
    for (const r of failed) {
      console.log(chalk.red(`  • ${r.name}`));
      if (r.stderr) {
        console.log(chalk.gray(`    ${r.stderr.split("\n").slice(0, 5).join("\n    ")}`));
      }
    }
  }

  if (blockingFailed.length > 0) {
    console.error(
      chalk.red(`\n🚫 ${blockingFailed.length} blocking gate(s) failed. Fix these before proceeding.\n`)
    );
    process.exitCode = 1;
  } else if (failed.length > 0) {
    console.warn(chalk.yellow(`\n⚠️  ${failed.length} non-blocking gate(s) failed.\n`));
    process.exitCode = 1;
  } else {
    console.log(chalk.green("\n✅ All quality gates passed.\n"));
  }
}
