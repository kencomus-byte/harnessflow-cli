import { execFile } from "child_process";
import { promisify } from "util";
import { resolve } from "path";
import chalk from "chalk";
import { HarnessConfig } from "../types.js";

const execFileAsync = promisify(execFile);

export interface QualityGateResult {
  name: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
  blocking: boolean;
}

export class QualityGateRunner {
  constructor(
    private projectRoot: string,
    private config: HarnessConfig
  ) {}

  /**
   * Run quality gates filtered by the `on` trigger.
   * Returns results for all gates, prints summary.
   */
  async runGates(
    trigger: "always" | "session_end",
    verbose = false
  ): Promise<QualityGateResult[]> {
    const gates = this.config.quality_gates.filter(
      (g) => g.on === trigger || g.on === "always"
    );

    if (gates.length === 0) {
      return [];
    }

    console.log(chalk.cyan(`\n🔬 Running ${gates.length} quality gate(s)...\n`));

    const results: QualityGateResult[] = [];

    for (const gate of gates) {
      const result = await this.runSingleGate(
        gate.name,
        gate.command,
        gate.timeout,
        gate.working_dir,
        gate.blocking,
        verbose
      );
      results.push(result);

      const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
      const status = result.passed ? chalk.green("PASS") : chalk.red("FAIL");
      const timing = chalk.gray(`(${result.durationMs}ms)`);
      console.log(`  ${icon} ${gate.name} — ${status} ${timing}`);

      if (!result.passed && verbose) {
        if (result.stdout) {
          console.log(chalk.gray("    stdout: " + result.stdout.slice(0, 300)));
        }
        if (result.stderr) {
          console.log(chalk.red("    stderr: " + result.stderr.slice(0, 300)));
        }
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(
      chalk.gray(`\n  Quality gates: `) +
      chalk.green(`${passed} passed`) +
      (failed > 0 ? chalk.red(`, ${failed} failed`) : "")
    );

    return results;
  }

  /**
   * Check if any blocking gate failed.
   */
  hasBlockingFailure(results: QualityGateResult[]): boolean {
    return results.some((r) => r.blocking && !r.passed);
  }

  private async runSingleGate(
    name: string,
    command: string,
    timeout: number,
    workingDir: string | undefined,
    blocking: boolean,
    _verbose: boolean
  ): Promise<QualityGateResult> {
    const cwd = workingDir
      ? resolve(this.projectRoot, workingDir)
      : this.projectRoot;

    const startMs = Date.now();

    try {
      const parts = command.split(/\s+/);
      const bin = parts[0];
      const args = parts.slice(1);

      const { stdout, stderr } = await execFileAsync(bin, args, {
        cwd,
        timeout: timeout * 1000,
      });

      return {
        name,
        command,
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs: Date.now() - startMs,
        passed: true,
        blocking,
      };
    } catch (err) {
      const e = err as { code?: number; stdout?: string; stderr?: string; message?: string };
      return {
        name,
        command,
        exitCode: e.code ?? 1,
        stdout: e.stdout?.trim() ?? "",
        stderr: e.stderr?.trim() ?? e.message ?? "Unknown error",
        durationMs: Date.now() - startMs,
        passed: false,
        blocking,
      };
    }
  }
}
