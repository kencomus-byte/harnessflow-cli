import { useGetSession, useGetSessionTrace, useGetSessionEval } from "@workspace/api-client-react";
import { formatCost, formatDuration, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Terminal, Cpu, Clock, DollarSign, Activity, AlertTriangle, CheckCircle2, Shield, Settings2 } from "lucide-react";
import { useRoute } from "wouter";

export default function SessionDetail() {
  const [, params] = useRoute("/sessions/:sessionId");
  const sessionId = params?.sessionId || "";

  const { data: session, isLoading: loadingSession } = useGetSession(sessionId);
  const { data: traces, isLoading: loadingTrace } = useGetSessionTrace(sessionId);
  const { data: evaluation, isLoading: loadingEval } = useGetSessionEval(sessionId);

  if (loadingSession) {
    return <div className="p-8"><Skeleton className="h-64 w-full bg-muted/20" /></div>;
  }

  if (!session) {
    return <div className="p-8 text-center font-mono">Session not found.</div>;
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground truncate">
            {session.sessionId}
          </h1>
          <Badge variant={session.status === "FAILED" ? "destructive" : "default"} className="font-mono uppercase">
            {session.status}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          {session.task}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox icon={Clock} label="Duration" value={formatDuration(session.durationMs)} />
        <StatBox icon={Cpu} label="Tokens" value={session.tokenUsage?.totalTokens?.toLocaleString() || "-"} />
        <StatBox icon={DollarSign} label="Cost" value={formatCost(session.tokenUsage?.estimatedCostUsd)} />
        <StatBox icon={Settings2} label="Backend" value={`${session.backend} ${session.model || ''}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="col-span-1 lg:col-span-2 space-y-4">
          <h2 className="font-mono text-sm tracking-wider uppercase text-muted-foreground flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            Execution Trace
          </h2>
          
          <Card className="border-border/50 bg-card/30">
            <div className="p-4 space-y-4 font-mono text-xs">
              {loadingTrace ? (
                <Skeleton className="h-48 w-full bg-muted/20" />
              ) : traces?.length === 0 ? (
                <div className="text-muted-foreground italic">No trace events recorded.</div>
              ) : (
                traces?.map((trace, i) => (
                  <div key={i} className="flex gap-3 border-b border-border/30 pb-3 last:border-0 last:pb-0">
                    <div className="w-20 text-muted-foreground shrink-0 pt-0.5">
                      {formatDate(trace.ts).split(', ')[1]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 font-bold tracking-tight rounded-sm ${
                          trace.type === 'ERROR' ? 'bg-destructive/20 text-destructive' :
                          trace.type === 'TOOL_CALL' ? 'bg-primary/10 text-primary' :
                          'bg-muted text-foreground'
                        }`}>
                          {trace.type}
                        </span>
                        {trace.tool && (
                          <span className="text-muted-foreground">{trace.tool}</span>
                        )}
                        {trace.durationMs && (
                          <span className="text-muted-foreground ml-auto">{trace.durationMs}ms</span>
                        )}
                      </div>
                      
                      {trace.message && (
                        <div className="text-foreground mt-1 whitespace-pre-wrap">{trace.message}</div>
                      )}
                      
                      {trace.input && (
                        <div className="mt-2 bg-background p-2 rounded border border-border/50 overflow-x-auto text-muted-foreground">
                          {JSON.stringify(trace.input, null, 2)}
                        </div>
                      )}
                      
                      {trace.blocked && (
                        <div className="mt-2 text-destructive flex items-center gap-1.5 bg-destructive/10 p-1.5 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Guardrail blocked: {trace.reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Evaluation Panel */}
        <div className="col-span-1 space-y-4">
          <h2 className="font-mono text-sm tracking-wider uppercase text-muted-foreground flex items-center">
            <Shield className="w-4 h-4 mr-2" />
            Quality Gates
          </h2>
          
          <Card className="border-border/50 bg-card/30">
            <CardContent className="p-4">
              {loadingEval ? (
                <Skeleton className="h-32 w-full bg-muted/20" />
              ) : !evaluation ? (
                <div className="text-xs font-mono text-muted-foreground">Evaluation not available.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b border-border/50">
                    <span className="font-mono text-xs">Overall Eval</span>
                    <Badge variant={evaluation.status === 'PASSED' ? 'default' : 'destructive'} className="font-mono">
                      {evaluation.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {evaluation.qualityGates?.map((gate, i) => (
                      <div key={i} className="flex items-center justify-between font-mono text-xs p-2 bg-background rounded border border-border/50">
                        <span className="truncate mr-2" title={gate.name}>{gate.name}</span>
                        {gate.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                      </div>
                    ))}
                    {(!evaluation.qualityGates || evaluation.qualityGates.length === 0) && (
                      <div className="text-xs font-mono text-muted-foreground">No quality gates executed.</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-card/50 border border-border/50 p-4 rounded-md flex flex-col gap-2">
      <div className="flex items-center text-muted-foreground gap-2 font-mono text-xs uppercase tracking-wider">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="text-lg font-mono font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}
