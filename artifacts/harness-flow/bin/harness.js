#!/usr/bin/env node
// HarnessFlow CLI entry point

import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(__dirname, "../dist/index.cjs");
const srcEntry = resolve(__dirname, "../src/index.ts");

if (existsSync(distEntry)) {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  require(distEntry);
} else if (existsSync(srcEntry)) {
  const { spawnSync } = await import("child_process");
  const result = spawnSync(
    "node",
    ["--import", "tsx/esm", srcEntry, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: process.env,
      cwd: process.cwd(),
    }
  );
  process.exit(result.status ?? 0);
} else {
  console.error("HarnessFlow: cannot find entry point. Run `pnpm build` first.");
  process.exit(1);
}
