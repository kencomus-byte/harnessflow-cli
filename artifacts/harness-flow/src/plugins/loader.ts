import { existsSync, readdirSync } from "fs";
import { resolve, basename } from "path";
import { HarnessConfig, HookConfig } from "../types.js";

export interface HarnessPlugin {
  name: string;
  version: string;
  description?: string;
  hooks?: {
    pre_tool?: Omit<HookConfig, "script">[];
    post_tool?: Omit<HookConfig, "script">[];
    on_session_end?: Omit<HookConfig, "script">[];
  };
  onEvent?: (event: { type: string; [key: string]: unknown }) => void | Promise<void>;
}

export interface LoadedPlugin {
  plugin: HarnessPlugin;
  filePath: string;
  loadError?: string;
}

export class PluginLoader {
  private loaded: LoadedPlugin[] = [];
  private initialized = false;

  constructor(
    private projectRoot: string,
    private config: HarnessConfig
  ) {}

  async load(): Promise<LoadedPlugin[]> {
    if (this.initialized) return this.loaded;
    this.initialized = true;

    if (!this.config.plugins.enabled) {
      return this.loaded;
    }

    const pluginDir = resolve(this.projectRoot, this.config.plugins.dir);
    if (!existsSync(pluginDir)) {
      return this.loaded;
    }

    const pluginFiles = readdirSync(pluginDir).filter(
      (f) => f.endsWith(".mjs") || f.endsWith(".js") || f.endsWith(".cjs")
    );

    for (const file of pluginFiles) {
      const filePath = resolve(pluginDir, file);
      try {
        const mod = await import(filePath) as { default?: HarnessPlugin } | HarnessPlugin;
        const plugin: HarnessPlugin = ("default" in mod && mod.default) ? mod.default : mod as HarnessPlugin;

        if (!plugin.name || !plugin.version) {
          this.loaded.push({
            plugin: { name: basename(file, ".mjs"), version: "0.0.0" },
            filePath,
            loadError: "Plugin missing required fields: name, version",
          });
          continue;
        }

        this.loaded.push({ plugin, filePath });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.loaded.push({
          plugin: { name: basename(file, ".mjs"), version: "0.0.0" },
          filePath,
          loadError: msg,
        });
      }
    }

    return this.loaded;
  }

  getSuccessfullyLoaded(): HarnessPlugin[] {
    return this.loaded.filter((l) => !l.loadError).map((l) => l.plugin);
  }

  async emitEvent(event: { type: string; [key: string]: unknown }): Promise<void> {
    for (const { plugin } of this.loaded.filter((l) => !l.loadError)) {
      if (plugin.onEvent) {
        try {
          await plugin.onEvent(event);
        } catch (err) {
          process.stderr.write(
            `[harness:plugin:${plugin.name}] onEvent error: ${String(err)}\n`
          );
        }
      }
    }
  }

  getAdditionalHooks(): {
    pre_tool: HookConfig[];
    post_tool: HookConfig[];
    on_session_end: HookConfig[];
  } {
    const result: {
      pre_tool: HookConfig[];
      post_tool: HookConfig[];
      on_session_end: HookConfig[];
    } = { pre_tool: [], post_tool: [], on_session_end: [] };

    for (const { plugin } of this.loaded.filter((l) => !l.loadError)) {
      for (const hook of plugin.hooks?.pre_tool ?? []) {
        result.pre_tool.push({
          name: `${plugin.name}:${hook.name ?? "pre_tool"}`,
          script: resolve(this.projectRoot, this.config.plugins.dir, `${plugin.name}-pre.sh`),
          on_tools: hook.on_tools,
          blocking: hook.blocking ?? true,
          timeout: hook.timeout ?? 30,
        });
      }
      for (const hook of plugin.hooks?.post_tool ?? []) {
        result.post_tool.push({
          name: `${plugin.name}:${hook.name ?? "post_tool"}`,
          script: resolve(this.projectRoot, this.config.plugins.dir, `${plugin.name}-post.sh`),
          on_tools: hook.on_tools,
          blocking: hook.blocking ?? false,
          timeout: hook.timeout ?? 60,
        });
      }
      for (const hook of plugin.hooks?.on_session_end ?? []) {
        result.on_session_end.push({
          name: `${plugin.name}:${hook.name ?? "on_session_end"}`,
          script: resolve(this.projectRoot, this.config.plugins.dir, `${plugin.name}-end.sh`),
          blocking: hook.blocking ?? false,
          timeout: hook.timeout ?? 60,
        });
      }
    }

    return result;
  }
}
