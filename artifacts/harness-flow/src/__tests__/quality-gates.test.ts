import { describe, it, expect, beforeEach } from "@jest/globals";
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { HarnessConfigSchema } from "../types.js";
import { QualityGateRunner } from "../quality/runner.js";

function makeTmpDir(): string {
  return mkdtempSync(resolve(tmpdir(), "harness-quality-"));
}

function makeConfig(
  gates: { name: string; command: string; on?: "always" | "session_end"; blocking?: boolean; timeout?: number }[]
) {
  return HarnessConfigSchema.parse({
    quality_gates: gates,
  });
}

describe("QualityGateRunner", () => {
  it("returns empty array when no gates configured", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig([]);
      const runner = new QualityGateRunner(dir, config);
      const results = await runner.runGates("session_end");
      expect(results).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("passes a gate that succeeds (exit 0)", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig([
        { name: "Echo test", command: "echo hello", on: "session_end", blocking: false },
      ]);
      const runner = new QualityGateRunner(dir, config);
      const results = await runner.runGates("session_end");
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].name).toBe("Echo test");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("fails a gate that exits non-zero", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig([
        { name: "Failing gate", command: "sh -c 'exit 1'", on: "session_end", blocking: false },
      ]);
      const runner = new QualityGateRunner(dir, config);
      const results = await runner.runGates("session_end");
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("hasBlockingFailure returns true when blocking gate fails", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig([
        { name: "Blocking fail", command: "sh -c 'exit 1'", on: "session_end", blocking: true },
      ]);
      const runner = new QualityGateRunner(dir, config);
      const results = await runner.runGates("session_end");
      expect(runner.hasBlockingFailure(results)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("hasBlockingFailure returns false when only non-blocking gate fails", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig([
        { name: "Non-blocking fail", command: "sh -c 'exit 1'", on: "session_end", blocking: false },
      ]);
      const runner = new QualityGateRunner(dir, config);
      const results = await runner.runGates("session_end");
      expect(runner.hasBlockingFailure(results)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("runs only 'always' gates when trigger is always", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig([
        { name: "Session gate", command: "echo session", on: "session_end" },
        { name: "Always gate", command: "echo always", on: "always" },
      ]);
      const runner = new QualityGateRunner(dir, config);
      const results = await runner.runGates("always");
      const names = results.map((r) => r.name);
      expect(names).toContain("Always gate");
      expect(names).not.toContain("Session gate");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("runs both 'always' and 'session_end' gates when trigger is session_end", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig([
        { name: "Session gate", command: "echo session", on: "session_end" },
        { name: "Always gate", command: "echo always", on: "always" },
      ]);
      const runner = new QualityGateRunner(dir, config);
      const results = await runner.runGates("session_end");
      const names = results.map((r) => r.name);
      expect(names).toContain("Session gate");
      expect(names).toContain("Always gate");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
