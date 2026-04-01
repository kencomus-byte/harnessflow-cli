import { useListSessions } from "@workspace/api-client-react";
import { formatCost, formatDuration, formatRelative } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
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

export default function Sessions() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { data: sessions, isLoading } = useListSessions();

  const filteredSessions = sessions?.filter(s => statusFilter === "ALL" || s.status === statusFilter) || [];

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">Sessions</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Agent execution logs</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] font-mono text-sm bg-card border-border">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL STATUSES</SelectItem>
              <SelectItem value="RUNNING">RUNNING</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED</SelectItem>
              <SelectItem value="FAILED">FAILED</SelectItem>
              <SelectItem value="INTERRUPTED">INTERRUPTED</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-muted/20" />
          ))
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground font-mono">
            <Terminal className="mx-auto h-8 w-8 mb-3 opacity-20" />
            No sessions found
          </div>
        ) : (
          filteredSessions.map((session) => {
            const Icon = StatusIcon[session.status as keyof typeof StatusIcon] || Terminal;
            const iconColor = StatusColor[session.status as keyof typeof StatusColor] || "text-muted-foreground";

            return (
              <Link key={session.sessionId} href={`/sessions/${session.sessionId}`}>
                <Card className="group border-border/50 bg-card/40 hover:bg-card/80 transition-colors cursor-pointer flex flex-col sm:flex-row p-4 gap-4 items-start sm:items-center">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground shrink-0">
                          {session.sessionId.substring(0, 8)}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase border-border bg-background">
                          {session.backend} {session.model && `• ${session.model}`}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.task}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 w-full sm:w-auto overflow-x-auto text-xs font-mono text-muted-foreground">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Cpu className="w-3.5 h-3.5" />
                      {session.tokenUsage?.totalTokens ? session.tokenUsage.totalTokens.toLocaleString() : "-"} tk
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(session.durationMs)}
                    </div>
                    <div className="text-right w-16 shrink-0">
                      {formatRelative(session.startedAt)}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
