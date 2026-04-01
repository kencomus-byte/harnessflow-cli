import * as readline from "readline";
import { HarnessConfig } from "../types.js";

const BUILTIN_DESTRUCTIVE_PATTERNS: RegExp[] = [
  /rm\s+-rf?/,
  /rmdir\s+--recursive/,
  /del\s+\/[sfq]/i,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM\s+\w+\s*;?\s*$/im,
  /git\s+push\s+.*--force/,
  /git\s+push\s+.*-f\b/,
  /git\s+reset\s+--hard/,
  /sudo\s+rm/,
  /chmod\s+777/,
  />\s*\/dev\/sda/,
  /mkfs\./,
];

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /forget\s+your\s+system\s+prompt/i,
  /new\s+instructions:/i,
  /\[SYSTEM\]/,
  /\[INST\]/,
];

export type GuardrailDecision =
  | { action: "allow" }
  | { action: "deny"; reason: string }
  | { action: "confirm"; reason: string };

export class GuardrailLayer {
  private compiledBlockedPatterns: RegExp[];

  constructor(private config: HarnessConfig) {
    this.compiledBlockedPatterns = [
      ...BUILTIN_DESTRUCTIVE_PATTERNS,
      ...config.guardrails.blocked_patterns.map(
        (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      ),
    ];
  }

  checkCommand(command: string): GuardrailDecision {
    const mode = this.config.guardrails.mode;

    for (const pattern of this.compiledBlockedPatterns) {
      if (pattern.test(command)) {
        if (mode === "permissive") {
          return {
            action: "confirm",
            reason: `Potentially destructive pattern detected: ${pattern.source}`,
          };
        }
        if (mode === "strict") {
          return {
            action: "deny",
            reason: `Blocked in strict mode: pattern "${pattern.source}" matched`,
          };
        }
        return {
          action: "confirm",
          reason: `Destructive pattern detected: "${command.slice(0, 80)}"`,
        };
      }
    }

    return { action: "allow" };
  }

  checkPromptInjection(text: string): boolean {
    if (!this.config.guardrails.injection_detection) return false;

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  checkToolAllowed(toolName: string): boolean {
    const mode = this.config.guardrails.mode;
    if (mode === "permissive") return true;

    const allowed = this.config.guardrails.allowed_tools;
    return allowed.includes(toolName);
  }

  async promptUserConfirmation(reason: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      console.log(`\n⚠️  Guardrail Warning`);
      console.log(`   ${reason}`);
      console.log(`\n   [A] Allow once   [D] Deny   [Q] Quit session`);
      rl.question("   Choice: ", (answer) => {
        rl.close();
        const choice = answer.trim().toLowerCase();
        if (choice === "q" || choice === "quit") {
          console.log("Session aborted by user.");
          process.exit(0);
        }
        resolve(choice === "a" || choice === "allow");
      });
    });
  }
}
