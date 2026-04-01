import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useHealthCheck, useListSessions, useGetSessionTrace, useGetRecentActivity, useGetAnalyticsSummary } from "@workspace/api-client-react";
import { 
  LayoutGrid, Server, BarChart2, SlidersHorizontal, 
  Terminal, X, ChevronRight, ChevronDown, CircleDot, PlayCircle, StopCircle,
  AlertCircle, CheckCircle2, ChevronUp, Plus, Square, Send
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelative, formatDuration, formatCost } from "@/lib/format";
import { API } from "@/lib/config";
import NewSessionDialog from "@/components/new-session-dialog";

import Dashboard from "@/pages/dashboard";
import Sessions from "@/pages/sessions";
import SessionDetail from "@/pages/session-detail";
import Analytics from "@/pages/analytics";
import Config from "@/pages/config";

type TabData = {
  id: string;
  label: string;
  type: 'dashboard' | 'sessions' | 'analytics' | 'config' | 'session';
  sessionId?: string;
  icon: React.ElementType;
};

export function IDEShell() {
  const qc = useQueryClient();
  const [openTabs, setOpenTabs] = useState<TabData[]>([
    { id: 'dashboard.hf', label: 'dashboard.hf', type: 'dashboard', icon: LayoutGrid }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard.hf');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState<'trace' | 'output' | 'terminal'>('terminal');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const { data: health } = useHealthCheck({ query: { refetchInterval: 10000 } });
  const { data: analyticsSummary } = useGetAnalyticsSummary();

  const openOrFocusTab = (tab: TabData) => {
    if (!openTabs.find(t => t.id === tab.id)) {
      setOpenTabs(prev => [...prev, tab]);
    }
    setActiveTabId(tab.id);
    if (tab.type === 'session' && tab.sessionId) {
      setSelectedSessionId(tab.sessionId);
    }
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t.id !== id);
    setOpenTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1]?.id || '');
    }
  };

  const activeTab = openTabs.find(t => t.id === activeTabId);

  const handleSessionLaunched = useCallback((sessionId: string, execId: string) => {
    // Invalidate sessions list so sidebar refreshes
    qc.invalidateQueries({ queryKey: ['/api/sessions'] });
    qc.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
    // Open the new session tab
    openOrFocusTab({
      id: `session-${sessionId}`,
      label: `sess_${sessionId.substring(0, 8)}.hf`,
      type: 'session',
      sessionId,
      icon: Terminal,
    });
    // Switch bottom panel to terminal with the live exec stream
    setActiveBottomTab('terminal');
    setBottomPanelOpen(true);
  }, [qc, openTabs]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d1117] text-foreground font-mono overflow-hidden">
      {showNewSession && (
        <NewSessionDialog
          onClose={() => setShowNewSession(false)}
          onLaunched={handleSessionLaunched}
        />
      )}

      {/* Main horizontal flex */}
      <div className="flex flex-1 overflow-hidden">
        {/* Zone 1: Activity Bar */}
        <ActivityBar 
          openOrFocusTab={openOrFocusTab} 
          activeTabType={activeTab?.type} 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onNewSession={() => setShowNewSession(true)}
        />

        {/* Zone 2: Primary Sidebar */}
        {sidebarOpen && (
          <PrimarySidebar 
            openOrFocusTab={openOrFocusTab}
            selectedSessionId={selectedSessionId}
            setSelectedSessionId={setSelectedSessionId}
            onNewSession={() => setShowNewSession(true)}
            onRefresh={() => {
              qc.invalidateQueries({ queryKey: ['/api/sessions'] });
              qc.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
            }}
          />
        )}

        {/* Zone 3: Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117] overflow-hidden border-l border-[#30363d]">
          {/* Tab Bar */}
          <div className="flex h-9 bg-[#161b22] border-b border-[#30363d] overflow-x-auto overflow-y-hidden">
            {openTabs.map(tab => (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  if (tab.type === 'session' && tab.sessionId) {
                    setSelectedSessionId(tab.sessionId);
                  }
                }}
                className={`group flex items-center h-full px-3 border-r border-[#30363d] cursor-pointer min-w-[120px] max-w-[200px] ${
                  activeTabId === tab.id 
                    ? 'bg-[#0d1117] text-primary border-t-2 border-t-primary' 
                    : 'bg-[#161b22] text-muted-foreground hover:bg-[#0d1117] border-t-2 border-t-transparent'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 mr-2 shrink-0" />
                <span className="text-xs truncate flex-1">{tab.label}</span>
                <button 
                  onClick={(e) => closeTab(e, tab.id)}
                  className={`ml-2 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-muted ${
                    activeTabId === tab.id ? 'opacity-100' : ''
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-auto p-6 relative">
            {activeTab?.type === 'dashboard' && <Dashboard />}
            {activeTab?.type === 'sessions' && (
              <Sessions onOpenSession={(session) => {
                openOrFocusTab({
                  id: `session-${session.sessionId}`,
                  label: `sess_${session.sessionId.substring(0,8)}.hf`,
                  type: 'session',
                  sessionId: session.sessionId,
                  icon: Terminal
                });
              }} />
            )}
            {activeTab?.type === 'analytics' && <Analytics />}
            {activeTab?.type === 'config' && <Config />}
            {activeTab?.type === 'session' && activeTab.sessionId && (
              <SessionDetail sessionId={activeTab.sessionId} />
            )}
            {!activeTab && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                <LayoutGrid className="w-16 h-16" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zone 4: Bottom Terminal Panel */}
      {bottomPanelOpen && (
        <BottomPanel 
          activeBottomTab={activeBottomTab} 
          setActiveBottomTab={setActiveBottomTab}
          setBottomPanelOpen={setBottomPanelOpen}
          selectedSessionId={selectedSessionId}
        />
      )}

      {/* Zone 5: Status Bar */}
      <div className="h-6 w-full bg-[#005cc5] text-white flex items-center justify-between px-3 text-[10px] select-none shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 cursor-pointer hover:bg-white/20 px-1 rounded-sm">
            <div className={`w-2 h-2 rounded-full ${health ? 'bg-green-400' : 'bg-red-400'}`} />
            {health ? 'ONLINE' : 'OFFLINE'}
          </div>
          <div className="flex items-center cursor-pointer hover:bg-white/20 px-1 rounded-sm" onClick={() => setBottomPanelOpen(!bottomPanelOpen)}>
            <Terminal className="w-3 h-3 mr-1" />
            Terminal
          </div>
          <button 
            className="flex items-center gap-1 cursor-pointer hover:bg-white/20 px-1 rounded-sm"
            onClick={() => setShowNewSession(true)}
          >
            <Plus className="w-3 h-3" /> New Session
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="opacity-80">HarnessFlow</span>
          {analyticsSummary && (
            <>
              <span className="opacity-50">|</span>
              <span>{analyticsSummary.totalTokens.toLocaleString()} tk</span>
              <span className="opacity-50">|</span>
              <span>{formatCost(analyticsSummary.totalCostUsd)}</span>
              <span className="opacity-50">|</span>
              <span>{(analyticsSummary.successRate * 100).toFixed(1)}% SUCCESS</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityBar({ openOrFocusTab, activeTabType, sidebarOpen, setSidebarOpen, onNewSession }: any) {
  const items = [
    { type: 'dashboard', icon: LayoutGrid, id: 'dashboard.hf', label: 'dashboard.hf' },
    { type: 'sessions', icon: Server, id: 'sessions.hf', label: 'sessions.hf' },
    { type: 'analytics', icon: BarChart2, id: 'analytics.hf', label: 'analytics.hf' },
    { type: 'config', icon: SlidersHorizontal, id: 'harness.yaml', label: 'harness.yaml' },
  ];

  return (
    <div className="w-12 bg-[#0d1117] flex flex-col items-center py-2 gap-2 border-r border-[#30363d] shrink-0 z-20">
      {items.map(item => (
        <Tooltip key={item.id} placement="right">
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                if (activeTabType === item.type) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  openOrFocusTab({ ...item });
                  setSidebarOpen(true);
                }
              }}
              className={`relative w-full h-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${
                activeTabType === item.type ? 'text-foreground' : ''
              }`}
            >
              {activeTabType === item.type && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
              )}
              <item.icon className="w-6 h-6" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10} className="font-mono text-xs bg-popover border-border">
            {item.label}
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Spacer + New Session button at the bottom */}
      <div className="flex-1" />
      <Tooltip placement="right">
        <TooltipTrigger asChild>
          <button
            onClick={onNewSession}
            className="w-full h-12 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="font-mono text-xs bg-popover border-border">
          New Session (⌘N)
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function PrimarySidebar({ openOrFocusTab, selectedSessionId, setSelectedSessionId, onNewSession, onRefresh }: any) {
  const qc = useQueryClient();
  const { data: sessions, refetch } = useListSessions(undefined, { query: { refetchInterval: 3000 } });
  const [expanded, setExpanded] = useState({ RUNNING: true, COMPLETED: true, FAILED: true, INTERRUPTED: false });
  const [stopping, setStopping] = useState<Set<string>>(new Set());

  const grouped = {
    RUNNING: sessions?.filter(s => s.status === 'RUNNING') || [],
    COMPLETED: sessions?.filter(s => s.status === 'COMPLETED') || [],
    FAILED: sessions?.filter(s => s.status === 'FAILED') || [],
    INTERRUPTED: sessions?.filter(s => s.status === 'INTERRUPTED') || [],
  };

  const toggleGroup = (key: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStop = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setStopping(prev => new Set([...prev, sessionId]));
    try {
      await fetch(API.sessionStop(sessionId), { method: 'PATCH' });
      await refetch();
      qc.invalidateQueries({ queryKey: ['/api/analytics/summary'] });
    } finally {
      setStopping(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <PlayCircle className="w-3 h-3 text-primary animate-pulse mr-1.5 shrink-0" />;
      case 'COMPLETED': return <CheckCircle2 className="w-3 h-3 text-green-500 mr-1.5 shrink-0" />;
      case 'FAILED': return <AlertCircle className="w-3 h-3 text-destructive mr-1.5 shrink-0" />;
      case 'INTERRUPTED': return <StopCircle className="w-3 h-3 text-muted-foreground mr-1.5 shrink-0" />;
      default: return <CircleDot className="w-3 h-3 text-muted-foreground mr-1.5 shrink-0" />;
    }
  };

  return (
    <div className="w-[240px] bg-[#161b22] border-r border-[#30363d] flex flex-col shrink-0">
      {/* Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-[#30363d]">
        <span className="text-[10px] font-bold text-muted-foreground tracking-widest">EXPLORER</span>
        <Tooltip placement="bottom">
          <TooltipTrigger asChild>
            <button
              onClick={onNewSession}
              className="p-1 text-muted-foreground hover:text-primary rounded-sm hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-mono text-xs bg-popover border-border">
            New Session
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Session tree */}
      <div className="flex-1 overflow-y-auto py-2 select-none">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map(status => {
          const items = grouped[status];
          const isExp = expanded[status];
          if (items.length === 0 && status !== 'RUNNING') return null;
          
          return (
            <div key={status} className="mb-1">
              <div 
                className="flex items-center px-2 py-1 cursor-pointer hover:bg-muted/50 text-xs font-bold text-muted-foreground"
                onClick={() => toggleGroup(status)}
              >
                {isExp ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}
                {status} ({items.length})
              </div>
              {isExp && items.map(sess => (
                <div 
                  key={sess.sessionId}
                  onClick={() => {
                    setSelectedSessionId(sess.sessionId);
                    openOrFocusTab({
                      id: `session-${sess.sessionId}`,
                      label: `sess_${sess.sessionId.substring(0,8)}.hf`,
                      type: 'session',
                      sessionId: sess.sessionId,
                      icon: Terminal
                    });
                  }}
                  className={`flex items-center px-5 py-1 cursor-pointer text-xs group relative ${
                    selectedSessionId === sess.sessionId 
                      ? 'bg-primary/20 text-primary' 
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ height: '28px' }}
                >
                  {getStatusIcon(sess.status)}
                  <span className="truncate flex-1 mr-1">{sess.sessionId.substring(0,8)}</span>
                  
                  {/* Stop button for RUNNING sessions */}
                  {sess.status === 'RUNNING' && (
                    <button
                      onClick={(e) => handleStop(e, sess.sessionId)}
                      disabled={stopping.has(sess.sessionId)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive rounded-sm shrink-0"
                      title="Stop session"
                    >
                      <Square className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {isExp && status === 'RUNNING' && items.length === 0 && (
                <div className="px-6 py-1 text-[10px] text-muted-foreground/40 italic">no running sessions</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Terminal line type
interface TermLine {
  type: string;
  line?: string;
  ts?: string;
}

function BottomPanel({ activeBottomTab, setActiveBottomTab, setBottomPanelOpen, selectedSessionId }: any) {
  const { data: traces } = useGetSessionTrace(selectedSessionId || '', { query: { enabled: !!selectedSessionId && activeBottomTab === 'trace' }});
  const { data: activity } = useGetRecentActivity({ limit: 50 }, { query: { enabled: activeBottomTab === 'output' }});

  const [termInput, setTermInput] = useState('');
  const [termLines, setTermLines] = useState<TermLine[]>([
    { type: 'system', line: 'HarnessFlow Terminal — run harness commands directly in the browser', ts: new Date().toISOString() },
    { type: 'system', line: 'Examples:  harness run "Add JWT auth" --backend dry-run', ts: new Date().toISOString() },
    { type: 'system', line: '           harness status   |   harness check   |   harness --version', ts: new Date().toISOString() },
  ]);
  const [termBusy, setTermBusy] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const termEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [termLines]);

  const appendLine = (line: TermLine) => {
    setTermLines(prev => [...prev, line]);
  };

  const execCommand = async () => {
    const cmd = termInput.trim();
    if (!cmd || termBusy) return;

    setCmdHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    setTermInput('');
    appendLine({ type: 'prompt', line: `$ ${cmd}`, ts: new Date().toISOString() });
    setTermBusy(true);

    // Close any previous EventSource
    esRef.current?.close();

    try {
      const res = await fetch(API.terminalExec, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json() as { execId?: string; error?: string };

      if (!res.ok || data.error) {
        appendLine({ type: 'error', line: `Error: ${data.error ?? 'Unknown error'}`, ts: new Date().toISOString() });
        setTermBusy(false);
        return;
      }

      const es = new EventSource(API.terminalEvents(data.execId!));
      esRef.current = es;

      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data) as { type: string; line?: string; code?: number };
          if (parsed.type === 'done') {
            es.close();
            esRef.current = null;
            setTermBusy(false);
            appendLine({ type: 'system', line: `[Exit code: ${parsed.code ?? 0}]`, ts: new Date().toISOString() });
          } else {
            appendLine({ type: parsed.type, line: parsed.line ?? '', ts: new Date().toISOString() });
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTermBusy(false);
      };

    } catch (err: unknown) {
      appendLine({ type: 'error', line: `Network error: ${err instanceof Error ? err.message : 'unknown'}`, ts: new Date().toISOString() });
      setTermBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(idx);
      setTermInput(cmdHistory[idx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setTermInput(idx === -1 ? '' : cmdHistory[idx]);
    } else if (e.key === 'c' && e.ctrlKey) {
      esRef.current?.close();
      setTermBusy(false);
      appendLine({ type: 'system', line: '^C', ts: new Date().toISOString() });
    }
  };

  const getLineColor = (type: string) => {
    switch (type) {
      case 'prompt': return 'text-primary font-semibold';
      case 'stderr': return 'text-yellow-400';
      case 'error': return 'text-destructive';
      case 'system': return 'text-cyan-400/70 italic';
      default: return 'text-foreground';
    }
  };

  return (
    <div className="h-[220px] bg-[#0d1117] border-t border-[#30363d] flex flex-col shrink-0">
      {/* Tab bar */}
      <div className="flex h-9 border-b border-[#30363d] justify-between items-center pr-2 bg-[#161b22]">
        <div className="flex h-full">
          {(['terminal', 'trace', 'output'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveBottomTab(tab)}
              className={`px-4 text-xs tracking-wider uppercase border-b-2 flex items-center gap-1.5 ${activeBottomTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab === 'terminal' && <Terminal className="w-3 h-3" />}
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button onClick={() => setBottomPanelOpen(false)} className="p-1 hover:bg-muted rounded-sm">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TERMINAL tab */}
      {activeBottomTab === 'terminal' && (
        <div className="flex-1 flex flex-col overflow-hidden" onClick={() => inputRef.current?.focus()}>
          {/* Output scroll area */}
          <div className="flex-1 overflow-auto px-3 pt-2 pb-1 font-mono text-xs selection:bg-primary/30 space-y-0.5">
            {termLines.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all leading-5 ${getLineColor(line.type)}`}>
                {line.line}
              </div>
            ))}
            {termBusy && (
              <div className="flex items-center gap-2 text-muted-foreground/60">
                <span className="animate-pulse">▋</span>
                <span className="italic text-[10px]">running…</span>
              </div>
            )}
            <div ref={termEndRef} />
          </div>
          {/* Input line */}
          <div className="flex items-center border-t border-[#30363d] px-3 py-1.5 gap-2 bg-[#161b22]/60">
            <span className="text-primary text-xs shrink-0 select-none">
              {termBusy ? '⏳' : '$'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={termInput}
              onChange={e => setTermInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={termBusy}
              placeholder='harness run "Add JWT auth to API" --backend dry-run'
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none font-mono"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              onClick={execCommand}
              disabled={termBusy || !termInput.trim()}
              className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 shrink-0"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* TRACE tab */}
      {activeBottomTab === 'trace' && (
        <div className="flex-1 overflow-auto p-2 font-mono text-xs selection:bg-primary/30">
          <div className="space-y-1">
            {!selectedSessionId ? (
              <div className="text-muted-foreground/50 italic">// Select a session from the explorer to view trace output</div>
            ) : traces?.length === 0 ? (
              <div className="text-muted-foreground/50 italic">// No trace events found for this session</div>
            ) : (
              traces?.map((t, i) => {
                let colorClass = 'text-muted-foreground';
                if (t.type === 'SESSION_START' || t.type === 'SESSION_END') colorClass = 'text-cyan-400';
                if (t.type === 'TOOL_CALL') colorClass = 'text-blue-400';
                if (t.type === 'HOOK_RUN') colorClass = 'text-yellow-400';
                if (t.type === 'ERROR' || t.blocked) colorClass = 'text-red-400';

                return (
                  <div key={i} className="flex gap-4 hover:bg-muted/30 px-2 py-0.5 rounded-sm">
                    <span className="opacity-50 shrink-0">[{new Date(t.ts).toISOString().split('T')[1].replace('Z','')}]</span>
                    <span className={`shrink-0 w-24 ${colorClass}`}>[{t.type}]</span>
                    <span className={`flex-1 ${t.blocked ? 'text-red-400' : 'text-foreground'}`}>
                      {t.tool && <span className="text-blue-300 font-bold mr-2">{t.tool}</span>}
                      {t.message || t.reason || JSON.stringify(t.input)}
                    </span>
                    {t.durationMs && <span className="opacity-50 shrink-0">{t.durationMs}ms</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* OUTPUT tab */}
      {activeBottomTab === 'output' && (
        <div className="flex-1 overflow-auto p-2 font-mono text-xs selection:bg-primary/30">
          <div className="space-y-1">
            {activity?.map((a, i) => (
              <div key={i} className="flex gap-4 hover:bg-muted/30 px-2 py-0.5 rounded-sm">
                <span className="opacity-50 shrink-0">[{new Date(a.ts).toISOString().split('T')[1].replace('Z','')}]</span>
                <span className="shrink-0 w-24 text-muted-foreground">[{a.type}]</span>
                <span className="flex-1 text-foreground">{a.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
