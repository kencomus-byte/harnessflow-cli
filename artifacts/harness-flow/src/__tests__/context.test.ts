import { describe, it, expect } from "@jest/globals";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";
import { ContextManager } from "../context/manager.js";
import { HarnessConfigSchema, SessionState } from "../types.js";

function makeTmpDir(): string {
  const dir = join(
    tmpdir(),
    `harness-ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

const defaultConfig = HarnessConfigSchema.parse({});

describe("ContextManager", () => {
  it("loads context from project files", async () => {
    const dir = makeTmpDir();
    try {
      writeFileSync(join(dir, "CLAUDE.md"), "# My Project\nDoes cool stuff.", "utf8");
      mkdirSync(join(dir, ".harness"), { recursive: true });
      writeFileSync(
        join(dir, ".harness", "feature_list.md"),
        "## TODO\n- Feature A",
        "utf8"
      );

      const mgr = new ContextManager(dir, defaultConfig);
      const ctx = await mgr.loadContext();

      expect(ctx.projectInstructions).toContain("My Project");
      expect(ctx.featureList).toContain("Feature A");
      expect(ctx.totalTokensEstimate).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("uses default content when files are missing", async () => {
    const dir = makeTmpDir();
    try {
      const mgr = new ContextManager(dir, defaultConfig);
      const ctx = await mgr.loadContext();
      expect(ctx.projectInstructions).toBeTruthy();
      expect(ctx.featureList).toBeTruthy();
      expect(ctx.handoff).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("saves and reads back session state", async () => {
    const dir = makeTmpDir();
    mkdirSync(join(dir, ".harness"), { recursive: true });
    try {
      const mgr = new ContextManager(dir, defaultConfig);
      const session = mgr.createInitialSession("Test task", "dry-run");
      session.status = "COMPLETED";
      session.progress.filesChanged = ["src/index.ts"];

      await mgr.saveSession(session);

      const raw = readFileSync(join(dir, ".harness", "session.json"), "utf8");
      const loaded = JSON.parse(raw) as SessionState;
      expect(loaded.task).toBe("Test task");
      expect(loaded.status).toBe("COMPLETED");
      expect(loaded.progress.filesChanged).toContain("src/index.ts");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("creates handoff artifact", async () => {
    const dir = makeTmpDir();
    mkdirSync(join(dir, ".harness"), { recursive: true });
    try {
      const mgr = new ContextManager(dir, defaultConfig);
      const session = mgr.createInitialSession("Build feature X", "dry-run");
      session.status = "COMPLETED";
      session.nextSession.suggestedTask = "Add tests for feature X";

      await mgr.createHandoffArtifact(session);

      const handoffPath = join(dir, ".harness", "handoff.md");
      expect(existsSync(handoffPath)).toBe(true);

      const content = readFileSync(handoffPath, "utf8");
      expect(content).toContain("Build feature X");
      expect(content).toContain("Add tests for feature X");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("initializes project files when missing", () => {
    const dir = makeTmpDir();
    try {
      const mgr = new ContextManager(dir, defaultConfig);
      mgr.initProjectFiles();

      expect(existsSync(join(dir, "CLAUDE.md"))).toBe(true);
      expect(existsSync(join(dir, ".harness", "feature_list.md"))).toBe(true);
      expect(existsSync(join(dir, ".harness", "handoff.md"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("createInitialSession returns valid session shape", () => {
    const dir = makeTmpDir();
    try {
      const mgr = new ContextManager(dir, defaultConfig);
      const session = mgr.createInitialSession("My task", "claude", "claude-opus-4-5");

      expect(session.task).toBe("My task");
      expect(session.backend).toBe("claude");
      expect(session.model).toBe("claude-opus-4-5");
      expect(session.status).toBe("RUNNING");
      expect(session.sessionId).toMatch(/^session-/);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
