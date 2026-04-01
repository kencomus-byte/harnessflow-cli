import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readFileOrDefault(filePath: string, defaultContent = ""): string {
  try {
    if (existsSync(filePath)) {
      return readFileSync(filePath, "utf8");
    }
  } catch {
  }
  return defaultContent;
}

export function writeFileSafe(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf8");
}

export function generateSessionId(): string {
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\..+/, "")
    .slice(0, 15);
  return `session-${ts}`;
}

export function formatTimestamp(): string {
  return new Date().toISOString();
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatCost(tokens: number): string {
  const costPer1M = 15.0;
  const cost = (tokens / 1_000_000) * costPer1M;
  return `$${cost.toFixed(4)}`;
}

export function findProjectRoot(startDir: string = process.cwd()): string {
  let current = resolve(startDir);
  while (true) {
    if (
      existsSync(resolve(current, ".harness.yaml")) ||
      existsSync(resolve(current, "CLAUDE.md")) ||
      existsSync(resolve(current, "package.json"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}
