import { useListSessions } from "@workspace/api-client-react";
import { formatDuration, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Terminal, Cpu, Clock, CheckCircle2, XCircle, Loader2, StopCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const StatusIcon = {
  RUNNING: Loader2,
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  INTERRUPTED: StopCircle,
};

const StatusColor = {
  RUNNING: "text-primary animate-spin",
  COMPLETED: "text-green-500",
  FAILED: "text-destructive",
  INTERRUPTED: "text-muted-foreground",
};

export default function Sessions({ onOpenSession }: { onOpenSession: (session: any) => void }) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { data: sessions, isLoading } = useListSessions();

  const filteredSessions = sessions?.filter(s => statusFilter === "ALL" || s.status === statusFilter) || [];

  return (
    <div className="space-y-6 fade-in pb-8">
      <div className="flex justify-between items-end border-b border-[#30363d] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
          <p className="text-muted-foreground mt-1 text-xs">Agent execution logs</p>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs bg-[#161b22] border-[#30363d] rounded-sm">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-[#161b22] border-[#30363d] rounded-sm text-xs font-mono">
            <SelectItem value="ALL">ALL STATUSES</SelectItem>
            <SelectItem value="RUNNING">RUNNING</SelectItem>
            <SelectItem value="COMPLETED">COMPLETED</SelectItem>
            <SelectItem value="FAILED">FAILED</SelectItem>
            <SelectItem value="INTERRUPTED">INTERRUPTED</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-[#30363d] rounded-sm overflow-hidden bg-[#161b22]">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-3 bg-[#0d1117] border-b border-[#30363d] text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <div className="col-span-4">Session ID / Task</div>
          <div className="col-span-3">Backend / Model</div>
          <div className="col-span-2">Tokens</div>
          <div className="col-span-1">Duration</div>
          <div className="col-span-2 text-right">Started</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[#30363d]/50">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-3"><Skeleton className="h-6 w-full bg-muted/20 rounded-sm" /></div>
            ))
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              <Terminal className="mx-auto h-8 w-8 mb-3 opacity-20" />
              No sessions found
            </div>
          ) : (
            filteredSessions.map((session) => {
              const Icon = StatusIcon[session.status as keyof typeof StatusIcon] || Terminal;
              const iconColor = StatusColor[session.status as keyof typeof StatusColor] || "text-muted-foreground";

              return (
                <div 
                  key={session.sessionId} 
                  className="grid grid-cols-12 gap-4 p-3 hover:bg-[#30363d]/30 transition-colors cursor-pointer text-xs items-center"
                  onClick={() => onOpenSession(session)}
                >
                  <div className="col-span-4 flex items-center min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 mr-3 ${iconColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-foreground truncate">
                        {session.sessionId.substring(0, 16)}...
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {session.task}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex items-center">
                    <Badge variant="outline" className="text-[9px] uppercase border-[#30363d] bg-[#0d1117] font-mono rounded-sm px-1.5 py-0">
                      {session.backend} {session.model && `• ${session.model}`}
                    </Badge>
                  </div>

                  <div className="col-span-2 flex items-center text-muted-foreground">
                    <Cpu className="w-3 h-3 mr-1.5 opacity-50" />
                    {session.tokenUsage?.totalTokens ? session.tokenUsage.totalTokens.toLocaleString() : "-"}
                  </div>

                  <div className="col-span-1 flex items-center text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1.5 opacity-50" />
                    {formatDuration(session.durationMs)}
                  </div>

                  <div className="col-span-2 text-right text-muted-foreground text-[10px]">
                    {formatRelative(session.startedAt)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
