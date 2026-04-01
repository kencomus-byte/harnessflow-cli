import { useState, useEffect } from "react";
import { useGetConfig } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API } from "@/lib/config";

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function Config() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useGetConfig();
  const [editValue, setEditValue] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [parseError, setParseError] = useState<string | null>(null);

  // Sync editor when data first loads
  useEffect(() => {
    if (config && !isDirty) {
      setEditValue(JSON.stringify(config, null, 2));
    }
  }, [config]);

  const handleChange = (value: string) => {
    setEditValue(value);
    setIsDirty(true);
    setParseError(null);
    setSaveState('idle');

    // Validate JSON
    try {
      JSON.parse(value);
    } catch {
      setParseError('Invalid JSON');
    }
  };

  const handleReset = () => {
    if (config) {
      setEditValue(JSON.stringify(config, null, 2));
      setIsDirty(false);
      setParseError(null);
      setSaveState('idle');
    }
  };

  const handleSave = async () => {
    if (parseError || !isDirty) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(editValue);
    } catch {
      setParseError('Invalid JSON — cannot save');
      return;
    }

    setSaveState('saving');
    try {
      const res = await fetch(API.config, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((data.error as string) ?? `HTTP ${res.status}`);
      }

      setSaveState('saved');
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ['/api/config'] });
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (e: unknown) {
      setSaveState('error');
      setParseError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <div className="space-y-6 fade-in h-full flex flex-col pb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuration</h1>
          <p className="text-muted-foreground mt-1 text-xs">Edit and save your harness.yaml settings</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-1">
          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-mono rounded-sm gap-1.5 text-muted-foreground"
              onClick={handleReset}
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          )}
          <Button
            size="sm"
            className={`h-7 text-xs font-mono rounded-sm gap-1.5 ${
              saveState === 'saved' ? 'bg-green-600 hover:bg-green-700' :
              saveState === 'error' ? 'bg-destructive hover:bg-destructive/90' :
              'bg-primary hover:bg-primary/90'
            } text-primary-foreground`}
            onClick={handleSave}
            disabled={!isDirty || !!parseError || saveState === 'saving'}
          >
            {saveState === 'saving' ? (
              <><span className="animate-spin">⟳</span> Saving…</>
            ) : saveState === 'saved' ? (
              <><CheckCircle2 className="w-3 h-3" /> Saved</>
            ) : saveState === 'error' ? (
              <><AlertCircle className="w-3 h-3" /> Error</>
            ) : (
              <><Save className="w-3 h-3" /> Save Config</>
            )}
          </Button>
        </div>
      </div>

      <Card className="border border-[#30363d] bg-[#161b22] rounded-sm shadow-none flex-1 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-[#30363d] bg-[#0d1117] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">harness.yaml</span>
            {isDirty && <span className="text-[10px] text-yellow-500 italic">● modified</span>}
          </div>
          {parseError && (
            <div className="flex items-center gap-1 text-destructive text-[10px]">
              <AlertCircle className="w-3 h-3" />
              {parseError}
            </div>
          )}
        </div>
        <div className="p-0 flex-1 overflow-hidden flex flex-col bg-[#0d1117]/50">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-1/3 bg-muted/20 rounded-sm" />
              <Skeleton className="h-4 w-1/4 bg-muted/20 rounded-sm" />
              <Skeleton className="h-4 w-1/2 bg-muted/20 rounded-sm" />
            </div>
          ) : (
            <textarea
              className={`flex-1 w-full bg-transparent text-xs font-mono leading-relaxed p-4 resize-none focus:outline-none ${
                parseError ? 'text-destructive' : isDirty ? 'text-yellow-200' : 'text-blue-300'
              }`}
              value={editValue}
              onChange={e => handleChange(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              style={{ minHeight: 0 }}
            />
          )}
        </div>
      </Card>

      {/* Quick reference */}
      <div className="grid grid-cols-3 gap-3 text-xs font-mono">
        {[
          { key: 'backend', desc: 'claude | codex | dry-run' },
          { key: 'model', desc: 'e.g. claude-opus-4-5' },
          { key: 'guardrails.mode', desc: 'strict | permissive | off' },
        ].map(item => (
          <div key={item.key} className="bg-[#161b22] border border-[#30363d] rounded-sm px-3 py-2">
            <div className="text-primary text-[10px] font-bold">{item.key}</div>
            <div className="text-muted-foreground text-[10px] mt-0.5">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
