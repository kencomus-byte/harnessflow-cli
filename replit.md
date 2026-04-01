# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (HarnessFlow Dashboard backend)
│   └── harness-dashboard/  # React + Vite web dashboard (preview: /harness-dashboard)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/harness-dashboard` (`@workspace/harness-dashboard`)

HarnessFlow IDE-style web dashboard — React + Vite + Tailwind. VS Code/Cursor-style IDE layout.

**Layout zones**:
- Activity Bar (48px left): Dashboard, Sessions, Analytics, Config, New Session (+)
- Primary Sidebar (240px): File-tree session explorer grouped by status (RUNNING/COMPLETED/FAILED/INTERRUPTED). Stop button on RUNNING sessions. Poll interval: 3s.
- Tab Bar: closeable tabs (dashboard.hf, sessions.hf, analytics.hf, harness.yaml, sess_*.hf)
- Editor Area: tab-based navigation, no URL routing
- Bottom Panel: TERMINAL | TRACE | OUTPUT tabs. Terminal has full command input with SSE streaming
- Status Bar (24px): ONLINE | Terminal | + New Session | HarnessFlow | tokens | cost | success%

**Real functionality** (not just monitoring):
- **New Session dialog** (`components/new-session-dialog.tsx`): backend selector (dry-run/claude/codex), model, task textarea → `POST /api/sessions/start` → spawns harness CLI child process → live SSE output streams to terminal tab
- **Stop session**: ■ button on RUNNING sessions in sidebar → `PATCH /api/sessions/:id/stop` → SIGTERM
- **Config editor**: `pages/config.tsx` — editable JSON textarea with JSON validation, save/reset buttons → `PUT /api/config`
- **Integrated terminal**: `BottomPanel` terminal tab — command history (↑↓), SSE streaming from `POST /api/terminal/exec` + `GET /api/terminal/events/:execId`

**Port**: 18360 (env: `PORT`), preview path: `/harness-dashboard/`

### `artifacts/api-server` (`@workspace/api-server`) — Backend

Express 5 API server for HarnessFlow Dashboard.

**Architecture**: Mutable in-memory session store (`src/lib/session-store.ts`) + Process Manager (`src/lib/process-manager.ts`) that tracks spawned harness CLI processes and SSE listeners.

**Endpoints**:
- `GET /api/sessions` — list sessions (from mutable store, auto-updated when processes finish)
- `GET /api/sessions/:id` — get session detail
- `GET /api/sessions/:id/trace` — get trace events
- `GET /api/sessions/:id/eval` — get eval report
- `POST /api/sessions/start` — spawn `node artifacts/harness-flow/dist/index.cjs run <task> --backend <backend>` as child process; adds session to mutable store; polls until done and updates status
- `PATCH /api/sessions/:id/stop` — SIGTERM the running process; updates status to INTERRUPTED
- `GET /api/sessions/:id/exec-id` — get active execId for SSE streaming
- `POST /api/terminal/exec` — run any harness subcommand (run/status/check/eval/etc); returns execId
- `GET /api/terminal/events/:execId` — SSE stream of stdout/stderr from a running execution
- `GET /api/config` — get harness config (from mutable in-memory store)
- `PUT /api/config` — update harness config (in-memory)
- `GET /api/analytics/*` — summary, tokens timeline, tools stats, activity feed (computed from live session store)
- `GET /api/healthz` — health check

**Process Manager**:
- `startHarnessCommand(args, sessionId?)` → execId: spawns harness CLI, strips ANSI, broadcasts lines to SSE listeners
- `subscribeToExecution(execId, res)`: replays buffered output + streams new output via SSE
- `killProcess(sessionId)`: sends SIGTERM
- CLI path: `path.resolve(process.cwd(), '../../artifacts/harness-flow/dist/index.cjs')` (from `artifacts/api-server/` CWD)

**Port**: 8080 (env: `PORT`), routes mounted at `/api`

### `artifacts/harness-flow` (`@workspace/harness-flow`)

HarnessFlow CLI — a TypeScript harness layer sitting between users and AI coding agents (Claude CLI, Codex CLI).

**Architecture**: `User → HarnessFlow CLI → Adapter → Claude CLI / Codex CLI`

**Commands**:
- `harness init [--backend claude|codex|dry-run]` — initialize project (creates `.harness.yaml`, `CLAUDE.md`, `.harness/`)
- `harness run "<task>" [--dry-run] [--backend X] [--model Y] [--verbose]` — run an agent session
- `harness resume [sessionId]` — resume last session or a specific session
- `harness status [--tokens] [--traces] [--json]` — show session state, token usage, traces

**Modules**:
- `src/adapters/` — Claude CLI adapter (stream-json), Codex adapter, DryRun adapter (for testing)
- `src/context/` — ContextManager: loads CLAUDE.md, session.json, feature_list.md, handoff.md
- `src/prompt/` — PromptEngine: renders system prompt from templates, checks token budget
- `src/guardrail/` — GuardrailLayer: blocks/confirms destructive patterns (rm -rf, DROP TABLE, etc.), injection detection
- `src/hooks/` — HookRunner: pre_tool / post_tool / on_session_end hooks via shell scripts
- `src/session/` — SessionRunner: orchestrates run flow, handles events, saves state
- `src/telemetry/` — Tracer: JSONL trace files per session, token usage log
- `src/config.ts` — loads/validates `.harness.yaml` with Zod
- `src/types.ts` — all TypeScript interfaces (HarnessConfig, SessionState, AgentEvent, etc.)

**Session State**: `.harness/session.json` — persisted after each session
**Handoff Artifact**: `.harness/handoff.md` — written at end of session for context continuity
**Traces**: `.harness/traces/<sessionId>.jsonl` — full event log per session
**Token Log**: `.harness/token_usage.jsonl` — cumulative token usage across sessions

**Testing**:
- 31 unit tests (guardrail, config, context manager, dry-run adapter)
- 38 E2E integration tests across 7 test groups
- Run unit tests: `pnpm --filter @workspace/harness-flow run test`
- Run E2E: `pnpm --filter @workspace/harness-flow run test:e2e`

**Build**: `node build.mjs` → `dist/index.cjs` (esbuild CJS bundle)

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
