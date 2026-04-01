import chalk from "chalk";
import { HarnessConfig, SessionState, AgentEvent } from "../types.js";
import { ContextManager } from "../context/manager.js";
import { PromptEngine } from "../prompt/engine.js";
import { GuardrailLayer } from "../guardrail/layer.js";
import { HookRunner } from "../hooks/runner.js";
import { Tracer } from "../telemetry/tracer.js";
import { AgentAdapter, GuardrailAbortError } from "../adapters/interface.js";
import { USER_QUIT_SENTINEL } from "../guardrail/layer.js";
import { QualityGateRunner } from "../quality/runner.js";
import { PluginLoader } from "../plugins/loader.js";
import { formatTokenCount, formatCost, formatTimestamp } from "../utils.js";
import { basename } from "path";

export class SessionRunner {
  private contextManager: ContextManager;
  private promptEngine: PromptEngine;
  private guardrailLayer: GuardrailLayer;
  private hookRunner: HookRunner;
  private qualityGateRunner: QualityGateRunner;
  private pluginLoader: PluginLoader;

  constructor(
    private projectRoot: string,
    private config: HarnessConfig
  ) {
    this.contextManager = new ContextManager(projectRoot, config);
    this.promptEngine = new PromptEngine(projectRoot, config);
    this.guardrailLayer = new GuardrailLayer(config);
    this.hookRunner = new HookRunner(projectRoot);
    this.qualityGateRunner = new QualityGateRunner(projectRoot, config);
    this.pluginLoader = new PluginLoader(projectRoot, config);
  }

  async run(task: string, adapter: AgentAdapter, verbose = false): Promise<SessionState> {
    const session = this.contextManager.createInitialSession(
      task,
      adapter.name,
      this.config.model
    );

    const tracer = new Tracer(this.projectRoot, this.config, session.sessionId);
    tracer.logSessionStart(task, adapter.name);

    console.log(chalk.cyan(`\n📋 Session: ${session.sessionId}`));
    console.log(chalk.gray(`   Backend: ${adapter.name}`));

    const context = await this.contextManager.loadContext();
    const trimmedContext = this.promptEngine.trimContextIfNeeded(context);

    tracer.logContextLoad(
      [this.config.context.project_file, this.config.context.feature_list],
      context.totalTokensEstimate
    );

    const projectName = basename(this.projectRoot);
    const systemPrompt = this.promptEngine.buildSystemPrompt(trimmedContext, projectName);
    const taskPrompt = this.promptEngine.buildTaskPrompt(task);

    const budgetCheck = this.promptEngine.checkTokenBudget(systemPrompt, taskPrompt);
    if (budgetCheck.isOverBudget) {
      console.warn(
        chalk.yellow(
          `⚠️  Context is over budget (${formatTokenCount(budgetCheck.totalEstimate)} tokens). Consider reducing context.`
        )
      );
    } else if (budgetCheck.isWarning) {
      console.warn(
        chalk.yellow(
          `⚠️  Context usage high: ~${formatTokenCount(budgetCheck.totalEstimate)} tokens`
        )
      );
    }

    if (this.config.guardrails.injection_detection) {
      if (this.guardrailLayer.checkPromptInjection(task)) {
        console.error(chalk.red("🚫 Potential prompt injection detected in task."));
        tracer.logGuardrailBlock("prompt_injection", "deny");
        session.status = "FAILED";
        session.endedAt = formatTimestamp();
        await this.finalizeSession(session, tracer);
        return session;
      }
    }

    const agentRequest = {
      task: taskPrompt,
      systemPrompt,
      context: systemPrompt,
      allowedTools: this.config.guardrails.allowed_tools,
      model: this.config.model,
      sessionId: session.sessionId,
    };

    console.log(chalk.gray(`\n🚀 Starting agent...\n`));

    await this.pluginLoader.load();
    await this.pluginLoader.emitEvent({ type: "session_start", task, backend: adapter.name });

    try {
      const lastToolRef: { name: string | undefined } = { name: undefined };
      for await (const event of adapter.run(agentRequest)) {
        await this.handleEvent(event, session, tracer, verbose, lastToolRef);
        await this.pluginLoader.emitEvent({ ...event });
        if (event.type === "done") {
          session.tokenUsage = {
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            totalTokens: event.usage.totalTokens,
            estimatedCost: formatCostValue(event.usage.totalTokens),
          };
          tracer.logTokenUsage(event.usage);
          tracer.logToTokenFile(session.sessionId, event.usage);
        }
      }

      session.status = "COMPLETED";
      session.endedAt = formatTimestamp();

      await this.hookRunner.runHooks(this.config.hooks.on_session_end);
      await this.runQualityGatesForSession(verbose);

    } catch (err) {
      if (err instanceof GuardrailAbortError) {
        console.error(chalk.red(`\n🚫 Session aborted by guardrail: ${err.reason}`));
        session.status = "INTERRUPTED";
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n❌ Agent error: ${msg}`));
        session.status = "FAILED";
      }
      session.endedAt = formatTimestamp();
    } finally {
      await this.finalizeSession(session, tracer);
    }

    return session;
  }

  async resume(sessionId: string, adapter: AgentAdapter, verbose = false): Promise<SessionState> {
    const task = `Resume session ${sessionId}`;

    const session = this.contextManager.createInitialSession(task, adapter.name);
    session.sessionId = sessionId;

    const tracer = new Tracer(this.projectRoot, this.config, sessionId);
    tracer.logSessionStart(task, adapter.name);

    console.log(chalk.cyan(`\n🔄 Resuming session: ${sessionId}\n`));

    try {
      const lastToolRef: { name: string | undefined } = { name: undefined };
      for await (const event of adapter.resume(sessionId, task)) {
        await this.handleEvent(event, session, tracer, verbose, lastToolRef);
        if (event.type === "done") {
          session.tokenUsage = {
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            totalTokens: event.usage.totalTokens,
            estimatedCost: formatCostValue(event.usage.totalTokens),
          };
          tracer.logTokenUsage(event.usage);
          tracer.logToTokenFile(session.sessionId, event.usage);
        }
      }
      session.status = "COMPLETED";
      session.endedAt = formatTimestamp();
    } catch (err) {
      if (err instanceof GuardrailAbortError) {
        console.error(chalk.red(`\n🚫 Resume aborted by guardrail: ${err.reason}`));
        session.status = "INTERRUPTED";
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`\n❌ Resume error: ${msg}`));
        session.status = "FAILED";
      }
      session.endedAt = formatTimestamp();
    } finally {
      await this.finalizeSession(session, tracer);
    }

    return session;
  }

  private async runQualityGatesForSession(verbose: boolean): Promise<void> {
    if (this.config.quality_gates.length === 0) return;
    const results = await this.qualityGateRunner.runGates("session_end", verbose);
    if (this.qualityGateRunner.hasBlockingFailure(results)) {
      console.warn(chalk.yellow("⚠️  Blocking quality gates failed (session marked COMPLETED, but review issues above)."));
    }
  }

  private async finalizeSession(session: SessionState, tracer: Tracer): Promise<void> {
    await this.contextManager.saveSession(session);

    if (this.config.session.auto_handoff && session.status !== "FAILED") {
      await this.contextManager.createHandoffArtifact(session);
    }

    await this.pluginLoader.emitEvent({
      type: "session_end",
      status: session.status,
      sessionId: session.sessionId,
      totalTokens: session.tokenUsage.totalTokens,
      filesChanged: session.progress.filesChanged.length,
    });

    tracer.logSessionEnd(
      session.status,
      session.tokenUsage.totalTokens,
      session.progress.filesChanged.length
    );

    this.printSummary(session, tracer.getTraceFile());
  }

  private async handleEvent(
    event: AgentEvent,
    session: SessionState,
    tracer: Tracer,
    verbose: boolean,
    lastToolRef: { name: string | undefined }
  ): Promise<void> {
    switch (event.type) {
      case "thinking":
        if (verbose) {
          console.log(chalk.gray(`💭 ${event.content}`));
        }
        break;

      case "tool_call": {
        const toolAllowed = this.guardrailLayer.checkToolAllowed(event.tool);
        if (!toolAllowed) {
          tracer.logGuardrailBlock(`tool:${event.tool}`, "deny");
          throw new GuardrailAbortError(
            `Tool "${event.tool}" is not in the allowedTools list. Aborting session to prevent unauthorized tool use.`
          );
        }

        if (event.tool === "Bash" && typeof event.args.command === "string") {
          const decision = this.guardrailLayer.checkCommand(event.args.command);
          if (decision.action === "deny") {
            tracer.logGuardrailBlock(decision.reason, "deny");
            throw new GuardrailAbortError(
              `Destructive command blocked in strict mode: "${decision.reason}". Aborting session.`
            );
          }
          if (decision.action === "confirm" && this.config.guardrails.confirm_destructive) {
            tracer.logGuardrailBlock(decision.reason, "confirm");
            const answer = await this.guardrailLayer.promptUserConfirmation(decision.reason);
            if (answer === USER_QUIT_SENTINEL) {
              throw new GuardrailAbortError(
                `User requested quit during destructive command confirmation. Aborting session.`
              );
            }
            if (!answer) {
              throw new GuardrailAbortError(
                `User denied destructive command: "${decision.reason}". Aborting session.`
              );
            }
          }
        }

        const argsStr = JSON.stringify(event.args).slice(0, 120);
        console.log(chalk.blue(`🔧 ${event.tool}`) + chalk.gray(` ${argsStr}`));

        lastToolRef.name = event.tool;
        await this.hookRunner.runHooks(this.config.hooks.pre_tool, event.tool);
        tracer.logToolCall(event.tool, event.args, true, 0);

        if (event.tool === "Write" || event.tool === "Edit") {
          const file =
            (event.args.file_path as string | undefined) ||
            (event.args.path as string | undefined) ||
            "";
          if (file && !session.progress.filesChanged.includes(file)) {
            session.progress.filesChanged.push(file);
          }
        }
        break;
      }

      case "tool_result":
        if (verbose) {
          console.log(chalk.gray(`   → ${event.result.slice(0, 200)}`));
        }
        await this.hookRunner.runHooks(this.config.hooks.post_tool, lastToolRef.name);
        lastToolRef.name = undefined;
        break;

      case "message":
        process.stdout.write(event.content);
        if (!event.content.endsWith("\n")) process.stdout.write("\n");
        break;

      case "error":
        console.error(chalk.red(`❌ ${event.error}`));
        break;

      case "done":
        break;
    }
  }

  private printSummary(session: SessionState, traceFile: string): void {
    const { inputTokens, outputTokens, totalTokens } = session.tokenUsage;

    console.log(chalk.green("\n✅ Session complete"));
    console.log(chalk.gray(`   Status:        ${session.status}`));
    console.log(chalk.gray(`   Files changed:  ${session.progress.filesChanged.length}`));
    console.log(
      chalk.gray(
        `   Tokens:        in=${formatTokenCount(inputTokens)} out=${formatTokenCount(outputTokens)} total=${formatTokenCount(totalTokens)}`
      )
    );
    console.log(chalk.gray(`   Cost estimate:  ${formatCost(totalTokens)}`));
    console.log(chalk.gray(`   Trace:         ${traceFile}`));
  }
}

function formatCostValue(tokens: number): number {
  const costPer1M = 15.0;
  return (tokens / 1_000_000) * costPer1M;
}
