# KẾ HOẠCH XÂY DỰNG HARNESSFLOW CLI
## Bản Kế Hoạch Kiến Trúc Tổng Quan (Tiếng Việt)

> Dựa trên nghiên cứu toàn bộ tài liệu từ:
> - [Awesome Harness Engineering](https://github.com/walkinglabs/awesome-harness-engineering)
> - [Claude Code Documentation](https://code.claude.com/docs/en/overview)

---

## 1. TẦM NHÌN VÀ MỤC TIÊU

### Vấn đề cần giải quyết

Khi người dùng gọi trực tiếp Claude CLI hoặc Codex CLI, họ gặp các vấn đề cốt lõi sau:

| Vấn đề | Mô tả | Nguồn tham chiếu |
|--------|-------|-----------------|
| **Mất trí nhớ giữa các phiên** | AI hoàn toàn không nhớ phiên làm việc trước. "Giống như team kỹ sư làm theo ca, mỗi ca mới đến không nhớ gì từ ca trước" | Anthropic: Effective Harnesses for Long-Running Agents |
| **Context window bị lãng phí** | Người dùng đổ toàn bộ thông tin vào context mà không quản lý ngân sách token, dẫn đến "burn" token vào thông tin không cần thiết | Manus: Context Engineering, Anthropic: Effective Context Engineering |
| **Không có guardrails** | Không có lớp ngăn chặn các lệnh nguy hiểm (xóa file, drop table, force push). Tỷ lệ nhấp "approve" mù quáng tăng cao | Anthropic: Beyond Permission Prompts (sandboxing giảm 84% approval requests) |
| **Thiếu observability** | Không biết agent làm gì, tốn bao nhiêu token, thành công hay thất bại theo chiều nào | LangChain: Improving Deep Agents (traces giúp hiểu failure modes) |
| **Vendor lock-in** | Muốn chuyển từ Claude sang Codex hay GPT phải thay đổi toàn bộ workflow | Manus: "Be the boat, not the pillar stuck to the seabed" |
| **Prompt không nhất quán** | Prompts viết rải rác, không tái sử dụng được, khó maintain | 12 Factor Agents: Factor 2 — Own Your Prompts |
| **Mô hình "one-shot"** | Agent cố làm mọi thứ trong 1 lần, dẫn đến cạn context giữa chừng, để lại code dở dang | Anthropic: Harness Design for Long-Running Apps |

### Giải pháp: HarnessFlow CLI

```
TRƯỚC (Vấn đề):
User ──────────────────────────────────────────→ Claude CLI
         (không có kiểm soát, không có memory)

SAU (Giải pháp):
User → HarnessFlow CLI → Adapter → Claude CLI / Codex CLI / ...
         ↑
    [Context Manager]    [Prompt Engine]    [Guardrail Layer]
    [Hooks System]       [Session State]    [Observability]
```

**Định nghĩa Harness** (từ LangChain):
> "Agent = Model + Harness. Nếu bạn không phải model, thì bạn là harness. Harness là mọi đoạn code, config, và logic thực thi không phải là model."

---

## 2. KIẾN TRÚC TỔNG THỂ

### 2.1 Sơ đồ luồng dữ liệu chi tiết

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER (Terminal)                         │
│            $ harness run "build a login page"                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HarnessFlow CLI (harness)                     │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  1. Context      │    │  2. Prompt       │                   │
│  │     Manager      │    │     Engine       │                   │
│  │                  │    │                  │                   │
│  │  • Load CLAUDE.md│    │  • Load template │                   │
│  │  • Load session  │    │  • Inject context│                   │
│  │  • Load feature  │    │  • Token budget  │                   │
│  │    list          │    │  • KV-cache opt  │                   │
│  └──────────────────┘    └──────────────────┘                   │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  3. Guardrail    │    │  4. Hooks        │                   │
│  │     Layer        │    │     System       │                   │
│  │                  │    │                  │                   │
│  │  • Allow/deny    │    │  • pre-tool:     │                   │
│  │  • Confirm       │    │    lint, format  │                   │
│  │    destructive   │    │  • post-tool:    │                   │
│  │  • Injection     │    │    test, build   │                   │
│  │    detection     │    │  • quality gate  │                   │
│  └──────────────────┘    └──────────────────┘                   │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  5. Session      │    │  6. Observability│                   │
│  │     State Mgr    │    │  & Telemetry     │                   │
│  │                  │    │                  │                   │
│  │  • Initializer   │    │  • JSONL traces  │                   │
│  │    agent         │    │  • Token usage   │                   │
│  │  • Checkpoint    │    │  • Eval runner   │                   │
│  │  • Handoff       │    │  • Replay tool   │                   │
│  │    artifacts     │    │                  │                   │
│  └──────────────────┘    └──────────────────┘                   │
│                                                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Adapter Layer                              │
│                                                                  │
│   ┌────────────┐    ┌────────────┐    ┌─────────────────────┐   │
│   │ Claude CLI │    │ Codex CLI  │    │  Dry-Run Adapter    │   │
│   │  Adapter   │    │  Adapter   │    │  (testing/debug)    │   │
│   └─────┬──────┘    └─────┬──────┘    └─────────────────────┘   │
│         │                 │                                       │
└─────────┼─────────────────┼───────────────────────────────────--┘
          │                 │
          ▼                 ▼
    Claude CLI         Codex CLI
    (Anthropic)        (OpenAI)
```

### 2.2 Quy trình xử lý một request

```
1. USER chạy: $ harness run "build a login page"
   │
2. Context Manager:
   ├── Đọc CLAUDE.md từ project root
   ├── Đọc .harness/session.json (trạng thái phiên trước)
   └── Đọc .harness/feature_list.md (danh sách tính năng)
   │
3. Prompt Engine:
   ├── Nạp system prompt template
   ├── Inject context (CLAUDE.md + session + features)
   ├── Kiểm tra token budget (max 150k, dự phòng 8k cho output)
   └── Sắp xếp context theo KV-cache locality (static → dynamic)
   │
4. Guardrail Layer:
   ├── Kiểm tra lệnh có nằm trong allowed_tools không
   ├── Phát hiện pattern nguy hiểm (rm -rf, DROP TABLE...)
   └── Chạy prompt injection detector
   │
5. Hooks (pre-tool):
   └── Chạy lint.sh, format.sh trước khi gửi lệnh
   │
6. Adapter (Claude CLI):
   ├── Spawn process: claude --print --output-format json ...
   ├── Pipe stdin/stdout
   └── Parse JSON response
   │
7. Hooks (post-tool):
   ├── Chạy test.sh, typecheck.sh
   └── Nếu hook thất bại → block completion, báo lỗi
   │
8. Session State Manager:
   ├── Cập nhật .harness/session.json (progress, files changed)
   └── Tạo handoff artifact (tóm tắt cho phiên tiếp theo)
   │
9. Observability:
   ├── Ghi JSONL trace: .harness/traces/session-{timestamp}.jsonl
   └── Cập nhật .harness/token_usage.jsonl
   │
10. USER thấy kết quả + summary
```

---

## 3. CHI TIẾT TỪNG MODULE

### 3.1 Module 1: Context Manager

**Lý thuyết nền tảng:**
> "LLMs are stateless functions. Their weights are frozen — the agent knows absolutely nothing about your codebase at the beginning of each session. CLAUDE.md is the preferred way of doing this." — HumanLayer

> "Context is a critical but finite resource. The engineering problem is optimizing the utility of those tokens against the inherent constraints of LLMs." — Anthropic

**Chức năng:**

```typescript
interface ContextManager {
  // Nạp tất cả context files theo thứ tự ưu tiên
  loadContext(projectRoot: string): Promise<ContextBundle>;
  
  // Đọc CLAUDE.md / AGENTS.md
  loadProjectInstructions(): Promise<string>;
  
  // Đọc trạng thái phiên làm việc trước
  loadSessionState(): Promise<SessionState>;
  
  // Đọc feature list (việc đã làm, đang làm, cần làm)
  loadFeatureList(): Promise<FeatureList>;
  
  // Cập nhật session sau khi phiên kết thúc
  updateSession(result: AgentResult): Promise<void>;
  
  // Tạo handoff artifact cho phiên kế tiếp
  createHandoffArtifact(session: SessionState): Promise<string>;
}
```

**Cấu trúc file context:**

```
.harness/
├── session.json          # Trạng thái phiên hiện tại
├── feature_list.md       # Danh sách tính năng (TODO/WIP/DONE)
├── handoff.md            # Handoff artifact (phiên sau đọc)
├── traces/               # Trace logs
│   └── session-20260401-0900.jsonl
├── evals/                # Eval results
└── token_usage.jsonl     # Token tracking
```

**feature_list.md format:**

```markdown
# Feature List

## Đã hoàn thành (DONE)
- [x] User authentication (2026-03-30)
- [x] Database schema (2026-03-30)

## Đang làm (WIP)
- [ ] Login page UI — 70% done, cần thêm validation
- [ ] Error handling — chưa bắt đầu

## Cần làm (TODO)
- [ ] Dashboard
- [ ] User settings
- [ ] Email verification

## Lỗi chưa fix
- BUG: Form validation không hoạt động trên mobile (test-login.ts:45)
```

**handoff.md format** (Anthropic's initializer agent pattern):

```markdown
# Handoff Artifact — Session 2026-04-01 09:00

## Đã làm trong phiên này
- Xây dựng login form component (src/components/Login.tsx)
- Thêm API endpoint POST /api/auth/login (src/routes/auth.ts)
- Viết unit tests (tests/auth.test.ts)

## Trạng thái hiện tại
- Build: PASS
- Tests: 8/10 PASS, 2 FAIL
  - FAIL: test_login_invalid_email (chưa có email validation)
  - FAIL: test_login_rate_limit (chưa implement rate limiting)

## Việc cần làm tiếp theo
1. Fix email validation trong Login.tsx
2. Implement rate limiting middleware
3. Thêm remember-me functionality

## Files đã thay đổi
- src/components/Login.tsx (mới)
- src/routes/auth.ts (đã sửa)
- tests/auth.test.ts (mới)

## Lưu ý quan trọng
- Chưa commit (cần review trước)
- API secret trong .env.local (không commit)
```

---

### 3.2 Module 2: Prompt Engine

**Lý thuyết nền tảng:**
> "Factor 2: Own Your Prompts. Factor 3: Own Your Context Window. The context window is the single most important resource in an agentic system." — 12 Factor Agents

> "Design Around the KV-Cache — place stable, reused content at the beginning of the context (system prompt, project instructions) to maximize cache hits." — Manus

**Cấu trúc template system:**

```
prompts/
├── system.md          # System prompt template
├── task.md            # Task prompt template
├── handoff.md         # Handoff generation prompt
├── verification.md    # Self-verification prompt
└── compaction.md      # Context compaction prompt
```

**system.md template:**

```markdown
# System Prompt

You are working on {{project_name}}.

## Project Instructions
{{claude_md_content}}

## Current Session State
{{session_summary}}

## Feature Status
{{feature_list_summary}}

## Working Rules
- Make incremental progress — không cố làm hết một lần
- Sau mỗi bước nhỏ, chạy tests để verify
- Ghi chú rõ những gì đã làm và những gì còn dở
- Không xóa code mà không hỏi trước
```

**Token Budget Manager:**

```typescript
interface TokenBudgetManager {
  maxContext: number;          // Ví dụ: 150000
  reserveForOutput: number;    // Ví dụ: 8000
  warningThreshold: number;    // Ví dụ: 0.85 (85%)
  
  // Đếm token của một đoạn text (ước tính)
  countTokens(text: string): number;
  
  // Cắt context thông minh khi gần đến giới hạn
  trimContext(context: ContextBundle): ContextBundle;
  
  // Sắp xếp context theo KV-cache locality
  // Static (ít thay đổi) → đặt đầu
  // Dynamic (thay đổi mỗi phiên) → đặt cuối
  sortByKVCache(parts: ContextPart[]): ContextPart[];
}
```

**Context priority order (KV-cache optimized):**

```
1. [STATIC - luôn cache được]
   └── System prompt template
   └── CLAUDE.md (project instructions)
   
2. [SEMI-STATIC - cache theo ngày]
   └── Feature list tổng quan
   └── Architecture overview
   
3. [DYNAMIC - thay đổi mỗi phiên]
   └── Handoff artifact (phiên trước)
   └── Current session state
   └── Recent error messages
   
4. [REQUEST-SPECIFIC]
   └── User's current task
```

---

### 3.3 Module 3: Guardrail Layer

**Lý thuyết nền tảng:**
> "Sandboxing creates pre-defined boundaries within which Claude can work more freely, reducing permission prompts by 84% while increasing security and agency." — Anthropic

> "Confirmation mode, analyzers, sandboxing, and hard policies for reducing prompt-injection risk in autonomous coding agents." — OpenHands

**Guardrail modes:**

| Mode | Mô tả | Use case |
|------|-------|----------|
| `strict` | Chỉ cho phép Read, không tự viết/xóa | Code review, exploration |
| `normal` | Cho phép Read/Write nhưng confirm destructive | Development bình thường |
| `permissive` | Tự động approve hầu hết, chỉ chặn "cực kỳ nguy hiểm" | Trusted, automated tasks |

**Destructive action detector:**

```typescript
const DESTRUCTIVE_PATTERNS = [
  // File system
  /rm\s+-rf?/,
  /rmdir\s+--recursive/,
  /del\s+\/[sfq]/i,
  
  // Database
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM\s+\w+\s*;?\s*$/, // DELETE không có WHERE
  
  // Git
  /git\s+push\s+.*--force/,
  /git\s+push\s+.*-f\b/,
  /git\s+reset\s+--hard/,
  
  // System
  /sudo\s+rm/,
  /chmod\s+777/,
  /:\/>/,  // Ghi đè toàn bộ file
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /\bDAN\b.*jailbreak/i,
  /forget\s+your\s+system\s+prompt/i,
];
```

**Confirmation flow:**

```
Agent muốn chạy: rm -rf dist/
         │
         ▼
[Guardrail phát hiện pattern nguy hiểm]
         │
         ▼
HarnessFlow CLI:
  ⚠️  Lệnh nguy hiểm được phát hiện:
      rm -rf dist/
      
  Lệnh này sẽ xóa vĩnh viễn thư mục dist/ và mọi nội dung bên trong.
  
  [A] Cho phép một lần
  [B] Cho phép và thêm vào whitelist
  [C] Từ chối và bảo agent thử cách khác
  [Q] Dừng toàn bộ phiên
  
  Lựa chọn: _
```

---

### 3.4 Module 4: Hooks System

**Lý thuyết nền tảng:**
> "Hooks/Middleware for deterministic execution — compaction, continuation, lint checks." — LangChain: Anatomy of an Agent Harness

> "Moving quality checks into the loop instead of relying on after-the-fact manual review." — Thoughtworks

> "Claude Code hooks allow shell commands or HTTP requests to execute at specific points in the agent lifecycle." — Claude Code Docs

**Hook lifecycle:**

```
Agent muốn gọi tool "Write" để sửa file
          │
          ▼
    [pre-tool hooks]
    │  └── lint.sh (check code style)
    │  └── format.sh (auto-format)
    │  └── security-scan.sh (SAST check)
    │
    ├── Nếu hook thất bại: block tool call, báo lỗi
    └── Nếu hook thành công: cho phép tool call
          │
          ▼
    [Tool call thực thi]
          │
          ▼
    [post-tool hooks]
    │  └── typecheck.sh (tsc --noEmit)
    │  └── test.sh (run affected tests)
    │  └── build.sh (verify build passes)
    │
    ├── Nếu hook thất bại (blocking=true): báo lỗi, agent phải fix
    └── Nếu hook thành công: hoàn thành
```

**Hook configuration:**

```yaml
hooks:
  pre_tool:
    - name: "ESLint"
      script: .harness/hooks/lint.sh
      on_tools: [Write, Edit]
      timeout: 30

    - name: "Security Scan"
      script: .harness/hooks/security-scan.sh
      on_tools: [Write, Edit, Bash]
      timeout: 60

  post_tool:
    - name: "TypeCheck"
      script: .harness/hooks/typecheck.sh
      on_tools: [Write, Edit]
      blocking: true     # Agent phải fix nếu typecheck fail
      timeout: 60

    - name: "Tests"
      script: .harness/hooks/test.sh
      on_tools: [Write, Edit]
      blocking: true
      timeout: 120

  on_session_end:
    - name: "Quality Gate"
      script: .harness/hooks/quality-gate.sh
      blocking: true     # Chặn nếu có test fail cuối phiên
```

---

### 3.5 Module 5: Session State Manager

**Lý thuyết nền tảng:**
> "The core challenge: agents must work in discrete sessions, each beginning with no memory of what came before. Imagine engineers working in shifts where each new engineer arrives with no memory of the previous shift." — Anthropic: Effective Harnesses for Long-Running Agents

> "Two-fold solution: an initializer agent that sets up the environment on the first run, and a coding agent that makes incremental progress in every session while leaving clear artifacts for the next session." — Anthropic

**Initializer Agent Pattern:**

```
Lần chạy đầu tiên (init):
$ harness init
    │
    ▼
[Initializer Agent]
├── Tạo .harness/ directory
├── Generate CLAUDE.md từ harness.yaml config
├── Tạo feature_list.md ban đầu
├── Chạy init.sh (setup environment)
├── Ghi initial session.json
└── Tạo handoff.md đầu tiên (context cho coding agent)

Các phiên tiếp theo (run):
$ harness run "task"
    │
    ▼
[Coding Agent]
├── Đọc handoff.md từ phiên trước
├── Làm incremental progress
└── Ghi handoff.md mới cho phiên sau
```

**session.json schema:**

```json
{
  "sessionId": "session-20260401-090000",
  "startedAt": "2026-04-01T09:00:00Z",
  "endedAt": "2026-04-01T09:45:00Z",
  "backend": "claude",
  "model": "claude-opus-4-5",
  "task": "Build login page",
  "status": "COMPLETED",
  "progress": {
    "filesChanged": ["src/Login.tsx", "src/routes/auth.ts"],
    "testsAdded": 8,
    "testsPassing": 6,
    "testsFailing": 2
  },
  "tokenUsage": {
    "inputTokens": 45231,
    "outputTokens": 8923,
    "totalTokens": 54154,
    "estimatedCost": 0.82
  },
  "nextSession": {
    "suggestedTask": "Fix failing tests and add email validation",
    "blockers": ["email validation not implemented"],
    "criticalFiles": ["src/Login.tsx:123-145"]
  }
}
```

---

### 3.6 Module 6: Observability & Telemetry

**Lý thuyết nền tảng:**
> "We use Traces to understand agent failure modes at scale. Models are mostly black-boxes, but we can see their inputs and outputs in text space." — LangChain

> "Testing Agent Skills Systematically with Evals — turning agent traces into repeatable evals with JSONL logs and deterministic checks." — OpenAI

**JSONL Trace format:**

```jsonl
{"ts":"2026-04-01T09:00:00Z","type":"session_start","sessionId":"session-20260401-090000","task":"Build login page","backend":"claude"}
{"ts":"2026-04-01T09:00:05Z","type":"context_load","files":["CLAUDE.md","session.json","feature_list.md"],"tokens":8523}
{"ts":"2026-04-01T09:00:08Z","type":"tool_call","tool":"Read","args":{"file":"src/routes/auth.ts"},"success":true,"latencyMs":120}
{"ts":"2026-04-01T09:01:23Z","type":"hook_run","hook":"lint.sh","trigger":"pre_tool","exitCode":0,"durationMs":450}
{"ts":"2026-04-01T09:01:50Z","type":"tool_call","tool":"Write","args":{"file":"src/Login.tsx"},"success":true,"latencyMs":89}
{"ts":"2026-04-01T09:02:10Z","type":"hook_run","hook":"typecheck.sh","trigger":"post_tool","exitCode":1,"error":"Type error: ...","durationMs":2100}
{"ts":"2026-04-01T09:02:45Z","type":"guardrail_block","pattern":"rm -rf","action":"confirm","userChoice":"deny"}
{"ts":"2026-04-01T09:45:00Z","type":"session_end","status":"COMPLETED","totalTokens":54154,"filesChanged":3}
```

**Eval Runner — deterministic checks:**

```typescript
interface EvalRunner {
  // Chạy tất cả eval checks sau task
  runEvals(config: EvalConfig): Promise<EvalResult[]>;
  
  // Kiểm tra xem build có pass không
  checkBuild(): Promise<CheckResult>;
  
  // Kiểm tra tests có pass không
  checkTests(): Promise<CheckResult>;
  
  // Kiểm tra type errors
  checkTypes(): Promise<CheckResult>;
  
  // Kiểm tra code style
  checkLint(): Promise<CheckResult>;
}
```

**Token usage tracking:**

```
$ harness status

─────────────────────────────────────
 HarnessFlow — Session Statistics
─────────────────────────────────────
 Current project: my-app
 Backend: claude (claude-opus-4-5)

 Phiên hôm nay (2026-04-01):
   Sessions:     3
   Total tokens: 142,893
   Input:        108,234
   Output:       34,659
   Cost (est):   ~$2.15

 Phiên tuần này:
   Sessions:     12
   Total tokens: 489,230
   Cost (est):   ~$7.34

 Feature progress:
   ✅ DONE:  4 features
   🔄 WIP:   2 features
   📋 TODO:  8 features

 Phiên gần nhất:
   Task: Build login page
   Status: COMPLETED (2 tests failing)
   Duration: 45 min
   Next: Fix email validation
─────────────────────────────────────
```

---

### 3.7 Module 7: Adapter Layer

**Lý thuyết nền tảng:**
> "If model progress is the rising tide, we want to be the boat, not the pillar stuck to the seabed. Harness design must be orthogonal to the underlying models." — Manus

> "The harness is every piece of code, configuration, and execution logic that isn't the model itself." — LangChain

**Abstract Adapter Interface:**

```typescript
interface AgentAdapter {
  name: string;            // "claude" | "codex" | "dry-run"
  
  // Kiểm tra adapter có sẵn không (binary installed?)
  isAvailable(): Promise<boolean>;
  
  // Chạy một task và stream output
  run(request: AgentRequest): AsyncGenerator<AgentEvent>;
  
  // Resume phiên trước (nếu adapter hỗ trợ)
  resume(sessionId: string): AsyncGenerator<AgentEvent>;
  
  // Đếm token của request (để budget management)
  countTokens(request: AgentRequest): Promise<number>;
}

interface AgentRequest {
  task: string;
  systemPrompt: string;
  context: string;
  allowedTools: string[];
  model?: string;
}

type AgentEvent =
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; tool: string; args: any }
  | { type: 'tool_result'; result: any }
  | { type: 'message'; content: string }
  | { type: 'error'; error: string }
  | { type: 'done'; usage: TokenUsage };
```

**Claude CLI Adapter:**

Claude CLI hỗ trợ các flags quan trọng:
- `--print` / `-p`: Non-interactive, print to stdout
- `--output-format`: `json` | `stream-json` | `text`
- `--resume <sessionId>`: Resume phiên trước
- `--continue`: Continue last session
- `--model`: Chọn model cụ thể
- `--allowedTools`: Giới hạn tools
- `--disallowedTools`: Chặn specific tools
- `--system-prompt`: Override system prompt
- `--add-dir`: Thêm thư mục vào context

```typescript
class ClaudeCliAdapter implements AgentAdapter {
  name = 'claude';
  
  async *run(request: AgentRequest): AsyncGenerator<AgentEvent> {
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--model', request.model ?? 'claude-opus-4-5',
      '--allowedTools', request.allowedTools.join(','),
    ];
    
    // Spawn claude process
    const proc = spawn('claude', args, {
      env: { ...process.env },
      stdin: 'pipe',
    });
    
    // Gửi prompt qua stdin
    proc.stdin.write(request.task);
    proc.stdin.end();
    
    // Stream và parse JSON events
    for await (const line of proc.stdout) {
      yield parseClaudeEvent(line);
    }
  }
}
```

**Codex CLI Adapter:**

```typescript
class CodexCliAdapter implements AgentAdapter {
  name = 'codex';
  
  async *run(request: AgentRequest): AsyncGenerator<AgentEvent> {
    const args = [
      '--quiet',
      '--model', request.model ?? 'codex-1',
      '--approval-mode', 'suggest', // Suggest không auto-approve
    ];
    
    const proc = spawn('codex', args, { stdin: 'pipe' });
    proc.stdin.write(request.task);
    proc.stdin.end();
    
    for await (const line of proc.stdout) {
      yield parseCodexEvent(line);
    }
  }
}
```

**Dry-Run Adapter** (dùng cho testing harness):

```typescript
class DryRunAdapter implements AgentAdapter {
  name = 'dry-run';
  
  async *run(request: AgentRequest): AsyncGenerator<AgentEvent> {
    // Simulate agent events mà không gọi AI thực
    yield { type: 'thinking', content: '[DRY RUN] Processing...' };
    yield { type: 'tool_call', tool: 'Read', args: { file: 'CLAUDE.md' } };
    yield { type: 'tool_result', result: '# Project...' };
    yield { type: 'message', content: '[DRY RUN] Task completed (simulated)' };
    yield { type: 'done', usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
```

---

## 4. CẤU TRÚC DỰ ÁN ĐỀ XUẤT

```
harness-flow/
├── packages/
│   ├── cli/                          # Package chính — HarnessFlow CLI
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point: bin/harness
│   │   │   ├── commands/
│   │   │   │   ├── init.ts           # harness init
│   │   │   │   ├── run.ts            # harness run "task"
│   │   │   │   ├── resume.ts         # harness resume [sessionId]
│   │   │   │   ├── status.ts         # harness status
│   │   │   │   └── eval.ts           # harness eval
│   │   │   ├── context/
│   │   │   │   ├── manager.ts        # Context Manager
│   │   │   │   ├── loader.ts         # File loaders (CLAUDE.md, etc.)
│   │   │   │   └── handoff.ts        # Handoff artifact generator
│   │   │   ├── prompt/
│   │   │   │   ├── engine.ts         # Prompt Engine
│   │   │   │   ├── template.ts       # Template loader & renderer
│   │   │   │   └── budget.ts         # Token Budget Manager
│   │   │   ├── guardrail/
│   │   │   │   ├── layer.ts          # Guardrail Layer
│   │   │   │   ├── patterns.ts       # Destructive/injection patterns
│   │   │   │   └── confirm.ts        # Interactive confirmation UI
│   │   │   ├── hooks/
│   │   │   │   ├── runner.ts         # Hook Runner
│   │   │   │   └── types.ts          # Hook types
│   │   │   ├── session/
│   │   │   │   ├── manager.ts        # Session State Manager
│   │   │   │   ├── checkpoint.ts     # Checkpoint system
│   │   │   │   └── schema.ts         # session.json schema (Zod)
│   │   │   ├── telemetry/
│   │   │   │   ├── tracer.ts         # JSONL trace writer
│   │   │   │   ├── token-tracker.ts  # Token usage tracker
│   │   │   │   └── eval-runner.ts    # Eval runner
│   │   │   └── adapters/
│   │   │       ├── interface.ts      # Abstract AgentAdapter interface
│   │   │       ├── claude/
│   │   │       │   └── adapter.ts    # Claude CLI Adapter
│   │   │       ├── codex/
│   │   │       │   └── adapter.ts    # Codex CLI Adapter
│   │   │       └── dry-run/
│   │   │           └── adapter.ts    # Dry-Run Adapter
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                       # Shared types/utils
│       ├── src/
│       │   ├── types.ts              # Shared TypeScript types
│       │   └── utils.ts             # Utility functions
│       └── package.json
│
├── templates/                        # Templates cho user projects
│   ├── CLAUDE.md.template            # Template CLAUDE.md
│   ├── AGENTS.md.template            # Template AGENTS.md (cross-tool)
│   └── harness.yaml.template         # Template config file
│
├── prompts/                          # Prompt templates
│   ├── system.md                     # System prompt
│   ├── task.md                       # Task prompt
│   ├── handoff.md                    # Handoff generation prompt
│   ├── verification.md               # Self-verification prompt
│   └── compaction.md                 # Context compaction prompt
│
├── hooks/                            # Built-in hook scripts
│   ├── lint.sh                       # ESLint check
│   ├── typecheck.sh                  # TypeScript check
│   ├── test.sh                       # Run tests
│   ├── build.sh                      # Verify build
│   └── security-scan.sh             # Basic SAST
│
├── docs/
│   ├── PLAN_TONG_QUAN.md            # File này (kế hoạch tổng quan)
│   ├── getting-started.md           # Hướng dẫn bắt đầu
│   ├── architecture.md              # Kiến trúc chi tiết
│   ├── configuration.md             # Tài liệu cấu hình
│   └── adapters.md                  # Hướng dẫn viết adapter mới
│
└── examples/
    ├── simple-web-app/              # Ví dụ project đơn giản
    └── monorepo/                    # Ví dụ monorepo setup
```

---

## 5. CẤU HÌNH .harness.yaml

```yaml
# ============================================
# HarnessFlow Configuration File
# ============================================

# Backend AI CLI
backend: claude              # claude | codex | dry-run
model: claude-opus-4-5       # Model cụ thể của backend

# ── Context ────────────────────────────────
context:
  project_file: CLAUDE.md    # File hướng dẫn chính (tương thích AGENTS.md)
  feature_list: .harness/feature_list.md
  session_state: .harness/session.json
  handoff: .harness/handoff.md
  
  # Thư mục bổ sung để agent có thể đọc
  additional_dirs:
    - src/
    - docs/

# ── Token Budget ────────────────────────────
token_budget:
  max_context: 150000        # Max tokens trong context window
  reserve_for_output: 8000   # Dự phòng cho output
  warning_threshold: 0.85    # Cảnh báo khi dùng 85%

# ── Guardrails ──────────────────────────────
guardrails:
  mode: normal               # strict | normal | permissive
  
  allowed_tools:
    - Read
    - Write
    - Edit
    - Bash
    - Glob
    - Grep
  
  confirm_destructive: true
  
  blocked_patterns:
    - "rm -rf"
    - "DROP TABLE"
    - "DROP DATABASE"
    - "git push --force"
    - "git push -f"
  
  # Phát hiện prompt injection
  injection_detection: true

# ── Hooks ───────────────────────────────────
hooks:
  pre_tool:
    - name: "ESLint"
      script: .harness/hooks/lint.sh
      on_tools: [Write, Edit]
      timeout: 30
  
  post_tool:
    - name: "TypeCheck"
      script: .harness/hooks/typecheck.sh
      on_tools: [Write, Edit]
      blocking: true
      timeout: 60
    
    - name: "Tests"
      script: .harness/hooks/test.sh
      on_tools: [Write, Edit]
      blocking: true
      timeout: 120
  
  on_session_end:
    - name: "Quality Gate"
      script: .harness/hooks/quality-gate.sh
      blocking: false

# ── Session ─────────────────────────────────
session:
  # Số phiên tối đa trước khi force checkpoint
  checkpoint_every: 5
  
  # Tự động tạo handoff artifact sau mỗi phiên
  auto_handoff: true
  
  # Giữ tối đa N phiên trong lịch sử
  max_history: 50

# ── Observability ───────────────────────────
observability:
  trace_dir: .harness/traces
  eval_dir: .harness/evals
  token_log: .harness/token_usage.jsonl
  
  # Định dạng trace
  trace_format: jsonl        # jsonl | json
  
  # Tự động chạy evals sau mỗi phiên
  auto_eval: true
```

---

## 6. KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN

### Giai đoạn 0 — Nghiên cứu & Interface Design (1 tuần)

**Mục tiêu**: Xác định đúng interface, không build vội

| Việc cần làm | Chi tiết |
|---|---|
| Đọc Claude CLI reference | `claude --help`, test `--print`, `--output-format stream-json`, `--resume` |
| Đọc Codex CLI reference | `codex --help`, test output format |
| Thiết kế `.harness.yaml` schema | Dùng Zod để validate |
| Viết Adapter interface | TypeScript interface chuẩn |
| Viết CLAUDE.md template | Template cho user projects |
| Viết prompt templates | system.md, task.md, handoff.md, verification.md |

**Deliverables:**
- `packages/cli/src/adapters/interface.ts` (TypeScript interface)
- `templates/harness.yaml.template`
- `templates/CLAUDE.md.template`
- `prompts/*.md`

---

### Giai đoạn 1 — Core Harness CLI (2–3 tuần)

**Mục tiêu**: CLI chạy được, gọi Claude qua harness

| Tuần | Việc cần làm |
|------|---|
| Tuần 1 | Scaffold CLI (commander.js + TypeScript), `harness init`, `harness run` |
| Tuần 2 | Claude CLI Adapter, Context Manager cơ bản |
| Tuần 3 | Session State Manager, Guardrail cơ bản |

**Test scenario sau giai đoạn 1:**
```bash
cd my-project
harness init                        # Tạo .harness/ và CLAUDE.md
harness run "build a login page"    # Gọi Claude qua harness
harness status                      # Xem token usage
harness resume                      # Tiếp tục phiên trước
```

---

### Giai đoạn 2 — Prompt Engine & Hooks (2 tuần)

**Mục tiêu**: Prompt tái sử dụng được, hooks chạy tự động

| Tuần | Việc cần làm |
|------|---|
| Tuần 4 | Template system, Token Budget Manager |
| Tuần 5 | Hook Runner, Quality Gate |

**Test scenario sau giai đoạn 2:**
```bash
harness run "fix the login bug"
# → Tự động nạp prompt templates
# → Token budget warning khi context > 85%
# → Pre-tool: lint.sh chạy trước khi write
# → Post-tool: typecheck.sh chạy sau write (blocking nếu fail)
```

---

### Giai đoạn 3 — Observability (1–2 tuần)

**Mục tiêu**: Theo dõi được mọi thứ

| Tuần | Việc cần làm |
|------|---|
| Tuần 6 | JSONL trace logger, token tracking |
| Tuần 7 | Eval runner, replay tool |

**Test scenario sau giai đoạn 3:**
```bash
harness status              # Xem stats
harness traces              # Liệt kê trace files
harness replay session-123  # Xem lại phiên debug
harness eval                # Chạy quality gate
```

---

### Giai đoạn 4 — Multi-adapter & Mở rộng (2 tuần)

**Mục tiêu**: Hỗ trợ nhiều backend, dễ mở rộng

| Tuần | Việc cần làm |
|------|---|
| Tuần 8 | Codex CLI adapter, Dry-run adapter |
| Tuần 9 | Sub-agent orchestration, Plugin system |

**Test scenario sau giai đoạn 4:**
```bash
# Đổi backend không cần thay đổi workflow
harness run "build a login page" --backend codex

# Test harness mà không tốn API credit
harness run "build a login page" --backend dry-run

# Spawn nhiều sub-agents song song
harness run "build auth, db, and api" --parallel 3
```

---

## 7. THAM CHIẾU TÀI LIỆU ĐẦY ĐỦ

### Tài liệu đã nghiên cứu từ Awesome Harness Engineering

| Tài liệu | Module áp dụng | Bài học chính |
|----------|---------------|----------------|
| [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Session State (M5) | Initializer agent + coding agent pattern, handoff artifacts |
| [Anthropic: Harness Design for Long-Running Apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) | Session State (M5), Prompt Engine (M2) | Generator + evaluator pattern, incremental progress |
| [Anthropic: Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Context Manager (M1), Prompt Engine (M2) | Context là tài nguyên hữu hạn, cần quản lý như ngân sách |
| [Anthropic: Beyond Permission Prompts (Sandboxing)](https://www.anthropic.com/engineering/claude-code-sandboxing) | Guardrail Layer (M3) | Sandboxing giảm 84% approval prompts, pre-defined boundaries |
| [Anthropic: Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) | All modules | Workflows > raw prompting, tool design principles |
| [Anthropic: Writing Effective Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | Adapter Layer (M7) | Tool naming, descriptions, token efficiency |
| [Anthropic: Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | Observability (M6) | Single-turn vs multi-turn evals, deterministic checks |
| [Manus: Context Engineering Lessons](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) | Prompt Engine (M2), Context Manager (M1) | KV-cache locality, tool masking, filesystem memory |
| [HumanLayer: Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) | Context Manager (M1) | WHAT/WHY/HOW framework cho CLAUDE.md |
| [HumanLayer: 12 Factor Agents](https://www.humanlayer.dev/blog/12-factor-agents) | Prompt Engine (M2), Session State (M5) | Own prompts, own context window, stateless reducer pattern |
| [LangChain: Anatomy of an Agent Harness](https://blog.langchain.com/the-anatomy-of-an-agent-harness/) | All modules | Agent = Model + Harness, core harness components |
| [LangChain: Improving Deep Agents with Harness Engineering](https://blog.langchain.com/improving-deep-agents-with-harness-engineering/) | Observability (M6), Hooks (M4) | Traces + self-verification = +13.7 points on benchmark |
| [OpenAI: Harness Engineering — Leveraging Codex](https://openai.com/index/harness-engineering/) | All modules | 1 triệu dòng code, 0 dòng viết tay; context + constraints + GC |
| [Thoughtworks: Harness Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html) | All modules | Context engineering + architectural constraints + garbage collection |
| [Inngest: Your Agent Needs a Harness, Not a Framework](https://www.inngest.com/blog/your-agent-needs-a-harness-not-a-framework) | Session State (M5), Observability (M6) | Durable, event-driven infrastructure; state, retries, traces |
| [Claude Code: Overview](https://code.claude.com/docs/en/overview) | Adapter Layer (M7) | Full-featured CLI, terminal, VS Code, web |
| [Claude Code: Sub-Agents](https://code.claude.com/docs/en/sub-agents) | Session State (M5) | Custom subagents, permission modes, preload skills |
| [Claude Code: Hooks Reference](https://code.claude.com/docs/en/hooks) | Hooks System (M4) | Hook lifecycle, matcher patterns, pre/post-tool hooks |
| [Claude Code: Memory (CLAUDE.md)](https://code.claude.com/docs/en/memory) | Context Manager (M1) | CLAUDE.md files, rules/, path-specific rules |
| [Claude Code: MCP](https://code.claude.com/docs/en/mcp) | Adapter Layer (M7) | MCP servers, tool extensions |
| [OpenHands: Prompt Injection](https://openhands.dev/blog/mitigating-prompt-injection-attacks-in-software-agents) | Guardrail Layer (M3) | Confirmation mode, analyzers, sandboxing, hard policies |
| [12-Factor AgentOps](https://www.12factoragentops.com/) | All modules | Context discipline, validation, reproducible workflows |

---

## 8. TIÊU CHÍ HOÀN THÀNH (DEFINITION OF DONE)

### Giai đoạn 1 — Core Harness
- [ ] `npm install -g harness-flow` cài thành công
- [ ] `harness init` tạo `.harness/` và CLAUDE.md
- [ ] `harness run "task"` gọi Claude qua harness và hiển thị output
- [ ] `harness resume` đọc handoff và tiếp tục phiên trước
- [ ] `harness status` hiển thị token usage và feature progress
- [ ] Guardrail chặn lệnh `rm -rf` và yêu cầu xác nhận

### Giai đoạn 2 — Prompt Engine & Hooks
- [ ] Token budget warning khi context > 85% giới hạn
- [ ] Pre-tool hooks chạy trước Write/Edit
- [ ] Post-tool hooks chạy sau Write/Edit
- [ ] Blocking hook fail → agent nhận lỗi và phải fix

### Giai đoạn 3 — Observability
- [ ] Mọi tool call được ghi vào JSONL trace
- [ ] `harness status` hiển thị token usage theo phiên/ngày
- [ ] `harness eval` chạy quality gate checks
- [ ] `harness replay <session>` hiển thị lại trace

### Giai đoạn 4 — Multi-adapter
- [ ] `--backend codex` chạy được với Codex CLI
- [ ] `--backend dry-run` test harness không tốn API credit
- [ ] Thêm adapter mới chỉ cần implement `AgentAdapter` interface

---

## 9. CÁC RỦI RO VÀ CÁCH GIẢM THIỂU

| Rủi ro | Mức độ | Cách giảm thiểu |
|--------|--------|----------------|
| Claude CLI thay đổi interface | CAO | Adapter pattern — chỉ sửa 1 file adapter, không ảnh hưởng phần còn lại |
| Token budget ước tính không chính xác | TRUNG BÌNH | Dùng tiktoken hoặc claude-tokenizer, thêm buffer 10% |
| Hooks timeout làm chậm workflow | TRUNG BÌNH | Timeout config, non-blocking mode cho hooks không critical |
| Prompt injection xuyên qua guardrail | THẤP | Pattern matching + semantic check + sandbox |
| Session state bị corrupt | THẤP | Atomic write, backup file, validate schema với Zod trước khi đọc |

---

*Tài liệu này được tạo dựa trên nghiên cứu đầy đủ 20+ bài viết từ Awesome Harness Engineering (walkinglabs/awesome-harness-engineering) và Claude Code Documentation (code.claude.com/docs).*

*Ngày soạn: 2026-04-01*
