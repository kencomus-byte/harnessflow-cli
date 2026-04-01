import * as esbuild from "esbuild";
import { existsSync, mkdirSync, writeFileSync } from "fs";

if (!existsSync("dist")) mkdirSync("dist");

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.cjs",
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

writeFileSync(
  "dist/index.mjs",
  `import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mod = require('./index.cjs');
export default mod;
`,
  "utf8"
);

console.log("Build complete: dist/index.cjs + dist/index.mjs");
