import { describe, it, expect } from "@jest/globals";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { HarnessConfigSchema } from "../types.js";
import { PluginLoader } from "../plugins/loader.js";

function makeTmpDir(): string {
  return mkdtempSync(resolve(tmpdir(), "harness-plugins-"));
}

function makeConfig(pluginDir: string, enabled = true) {
  return HarnessConfigSchema.parse({
    plugins: { dir: pluginDir, enabled },
  });
}

describe("PluginLoader", () => {
  it("returns empty array when plugins dir does not exist", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig(resolve(dir, "nonexistent-plugins"));
      const loader = new PluginLoader(dir, config);
      const loaded = await loader.load();
      expect(loaded).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("returns empty array when plugins disabled", async () => {
    const dir = makeTmpDir();
    try {
      const pluginDir = resolve(dir, ".harness", "plugins");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        resolve(pluginDir, "test.mjs"),
        `export default { name: "test", version: "1.0.0" };`,
        "utf8"
      );

      const config = makeConfig(".harness/plugins", false);
      const loader = new PluginLoader(dir, config);
      const loaded = await loader.load();
      expect(loaded).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("returns empty array when plugins dir is empty", async () => {
    const dir = makeTmpDir();
    try {
      const pluginDir = resolve(dir, ".harness", "plugins");
      mkdirSync(pluginDir, { recursive: true });

      const config = makeConfig(".harness/plugins");
      const loader = new PluginLoader(dir, config);
      const loaded = await loader.load();
      expect(loaded).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("skips non-.mjs/.js/.cjs files in plugin dir", async () => {
    const dir = makeTmpDir();
    try {
      const pluginDir = resolve(dir, ".harness", "plugins");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(resolve(pluginDir, "README.md"), "# Plugins", "utf8");
      writeFileSync(resolve(pluginDir, "notes.txt"), "notes", "utf8");

      const config = makeConfig(".harness/plugins");
      const loader = new PluginLoader(dir, config);
      const loaded = await loader.load();
      expect(loaded).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("emitEvent does not throw when no plugins are loaded", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig(resolve(dir, "nonexistent"));
      const loader = new PluginLoader(dir, config);
      await loader.load();

      await expect(
        loader.emitEvent({ type: "tool_call", tool: "Bash", args: {} })
      ).resolves.not.toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("getSuccessfullyLoaded returns empty when no plugins loaded", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig(resolve(dir, "nonexistent"));
      const loader = new PluginLoader(dir, config);
      await loader.load();
      expect(loader.getSuccessfullyLoaded()).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("getAdditionalHooks returns empty object when no plugins loaded", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig(resolve(dir, "nonexistent"));
      const loader = new PluginLoader(dir, config);
      await loader.load();
      const hooks = loader.getAdditionalHooks();
      expect(hooks.pre_tool).toHaveLength(0);
      expect(hooks.post_tool).toHaveLength(0);
      expect(hooks.on_session_end).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("load() is idempotent — calling twice returns same results", async () => {
    const dir = makeTmpDir();
    try {
      const config = makeConfig(resolve(dir, "nonexistent"));
      const loader = new PluginLoader(dir, config);
      const first = await loader.load();
      const second = await loader.load();
      expect(first).toBe(second);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
