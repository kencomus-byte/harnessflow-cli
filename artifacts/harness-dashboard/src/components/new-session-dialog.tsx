import { useState } from "react";
import { X, PlayCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API } from "@/lib/config";

interface NewSessionDialogProps {
  onClose: () => void;
  onLaunched: (sessionId: string, execId: string) => void;
}

const BACKENDS = [
  { value: "dry-run", label: "dry-run (no external CLI needed)" },
  { value: "claude", label: "claude (requires claude CLI)" },
  { value: "codex", label: "codex (requires codex CLI)" },
];

const MODELS: Record<string, string[]> = {
  "dry-run": [],
  claude: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"],
  codex: ["o4-mini", "o3", "codex-mini-latest"],
};

export default function NewSessionDialog({ onClose, onLaunched }: NewSessionDialogProps) {
  const [task, setTask] = useState("");
  const [backend, setBackend] = useState("dry-run");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!task.trim()) {
      setError("Task description is required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string> = { task: task.trim(), backend };
      if (model) body.model = model;

      const res = await fetch(API.sessionsStart, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { sessionId: string; execId: string };
      onLaunched(data.sessionId, data.execId);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-sm shadow-2xl font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">New Harness Session</span>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Task */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Task <span className="text-destructive">*</span>
            </label>
            <textarea
              className="w-full h-28 bg-[#0d1117] border border-[#30363d] rounded-sm px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary"
              placeholder='Describe what you want the agent to do…&#10;e.g. "Refactor the auth module to use JWT tokens"'
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun(); }}
              autoFocus
            />
          </div>

          {/* Backend */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Backend
            </label>
            <select
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-sm px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
              value={backend}
              onChange={e => { setBackend(e.target.value); setModel(""); }}
            >
              {BACKENDS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>

          {/* Model (optional, only when backend has model options) */}
          {MODELS[backend]?.length > 0 && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Model <span className="text-muted-foreground/40">(optional)</span>
              </label>
              <select
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-sm px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                <option value="">— use default —</option>
                {MODELS[backend].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-sm text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted-foreground/50">⌘ + Enter to run</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-mono rounded-sm"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs font-mono rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={handleRun}
                disabled={loading || !task.trim()}
              >
                {loading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…</>
                ) : (
                  <><PlayCircle className="w-3.5 h-3.5" /> Run Session</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
