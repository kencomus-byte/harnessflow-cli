import { useEffect, useState } from "react";
import { useHealthCheck, useListSessions, useGetSessionTrace, useGetRecentActivity, useGetAnalyticsSummary } from "@workspace/api-client-react";
import { 
  LayoutGrid, Server, BarChart2, SlidersHorizontal, 
  Terminal, X, ChevronRight, ChevronDown, CircleDot, PlayCircle, StopCircle,
  AlertCircle, CheckCircle2, ChevronUp
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelative, formatDuration, formatCost } from "@/lib/format";

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
  const [openTabs, setOpenTabs] = useState<TabData[]>([
    { id: 'dashboard.hf', label: 'dashboard.hf', type: 'dashboard', icon: LayoutGrid }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard.hf');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState<'trace' | 'output'>('trace');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const { data: health } = useHealthCheck({ query: { refetchInterval: 10000 } });
  const { data: analyticsSummary } = useGetAnalyticsSummary();

  const openOrFocusTab = (tab: TabData) => {
    if (!openTabs.find(t => t.id === tab.id)) {
      setOpenTabs([...openTabs, tab]);
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

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d1117] text-foreground font-mono overflow-hidden">
      {/* Main horizontal flex */}
      <div className="flex flex-1 overflow-hidden">
        {/* Zone 1: Activity Bar */}
        <ActivityBar 
          openOrFocusTab={openOrFocusTab} 
          activeTabType={activeTab?.type} 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Zone 2: Primary Sidebar */}
        {sidebarOpen && (
          <PrimarySidebar 
            openOrFocusTab={openOrFocusTab}
            selectedSessionId={selectedSessionId}
            setSelectedSessionId={setSelectedSessionId}
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
            Panel
          </div>
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

function ActivityBar({ openOrFocusTab, activeTabType, sidebarOpen, setSidebarOpen }: any) {
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
    </div>
  );
}

function PrimarySidebar({ openOrFocusTab, selectedSessionId, setSelectedSessionId }: any) {
  const { data: sessions } = useListSessions();
  const [expanded, setExpanded] = useState({ RUNNING: true, COMPLETED: true, FAILED: true, INTERRUPTED: false });

  const grouped = {
    RUNNING: sessions?.filter(s => s.status === 'RUNNING') || [],
    COMPLETED: sessions?.filter(s => s.status === 'COMPLETED') || [],
    FAILED: sessions?.filter(s => s.status === 'FAILED') || [],
    INTERRUPTED: sessions?.filter(s => s.status === 'INTERRUPTED') || [],
  };

  const toggleGroup = (key: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <PlayCircle className="w-3 h-3 text-primary animate-pulse mr-2" />;
      case 'COMPLETED': return <CheckCircle2 className="w-3 h-3 text-green-500 mr-2" />;
      case 'FAILED': return <AlertCircle className="w-3 h-3 text-destructive mr-2" />;
      case 'INTERRUPTED': return <StopCircle className="w-3 h-3 text-muted-foreground mr-2" />;
      default: return <CircleDot className="w-3 h-3 text-muted-foreground mr-2" />;
    }
  };

  return (
    <div className="w-[240px] bg-[#161b22] border-r border-[#30363d] flex flex-col shrink-0">
      <div className="h-9 px-4 flex items-center text-[10px] font-bold text-muted-foreground tracking-widest border-b border-[#30363d]">
        EXPLORER
      </div>
      <div className="flex-1 overflow-y-auto py-2 select-none">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map(status => {
          const items = grouped[status];
          const isExp = expanded[status];
          if (items.length === 0 && status === 'INTERRUPTED') return null;
          
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
                  className={`flex items-center px-6 py-1 cursor-pointer text-xs group ${
                    selectedSessionId === sess.sessionId 
                      ? 'bg-primary/20 text-primary' 
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  style={{ height: '28px' }}
                >
                  {getStatusIcon(sess.status)}
                  <span className="truncate mr-2">{sess.sessionId.substring(0,8)}</span>
                  <span className="truncate opacity-50 text-[10px]">{sess.task}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BottomPanel({ activeBottomTab, setActiveBottomTab, setBottomPanelOpen, selectedSessionId }: any) {
  const { data: traces } = useGetSessionTrace(selectedSessionId || '', { query: { enabled: !!selectedSessionId && activeBottomTab === 'trace' }});
  const { data: activity } = useGetRecentActivity({ limit: 50 }, { query: { enabled: activeBottomTab === 'output' }});

  return (
    <div className="h-[220px] bg-[#0d1117] border-t border-[#30363d] flex flex-col shrink-0">
      <div className="flex h-9 border-b border-[#30363d] justify-between items-center pr-2 bg-[#161b22]">
        <div className="flex h-full">
          <button 
            onClick={() => setActiveBottomTab('trace')}
            className={`px-4 text-xs tracking-wider uppercase border-b-2 flex items-center ${activeBottomTab === 'trace' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Trace
          </button>
          <button 
            onClick={() => setActiveBottomTab('output')}
            className={`px-4 text-xs tracking-wider uppercase border-b-2 flex items-center ${activeBottomTab === 'output' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            Output
          </button>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button onClick={() => setBottomPanelOpen(false)} className="p-1 hover:bg-muted rounded-sm">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 font-mono text-xs selection:bg-primary/30">
        {activeBottomTab === 'trace' && (
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
        )}
        
        {activeBottomTab === 'output' && (
          <div className="space-y-1">
            {activity?.map((a, i) => (
              <div key={i} className="flex gap-4 hover:bg-muted/30 px-2 py-0.5 rounded-sm">
                <span className="opacity-50 shrink-0">[{new Date(a.ts).toISOString().split('T')[1].replace('Z','')}]</span>
                <span className="shrink-0 w-24 text-muted-foreground">[{a.type}]</span>
                <span className="flex-1 text-foreground">{a.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
