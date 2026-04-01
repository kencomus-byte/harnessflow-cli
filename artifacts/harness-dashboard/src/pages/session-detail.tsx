import { useGetSession, useGetSessionEval } from "@workspace/api-client-react";
import { formatCost, formatDuration } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, Clock, DollarSign, Shield, Settings2, CheckCircle2, XCircle } from "lucide-react";

export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const { data: session, isLoading: loadingSession } = useGetSession(sessionId);
  const { data: evaluation, isLoading: loadingEval } = useGetSessionEval(sessionId);

  if (loadingSession) {
    return <div className="p-8"><Skeleton className="h-64 w-full bg-muted/20 rounded-sm" /></div>;
  }

  if (!session) {
    return <div className="p-8 text-center font-mono text-muted-foreground text-xs">Session not found.</div>;
  }

  return (
    <div className="space-y-6 fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground truncate">
            {session.sessionId}
          </h1>
          <Badge variant={session.status === "FAILED" ? "destructive" : "default"} className="font-mono uppercase text-[10px] rounded-sm">
            {session.status}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs max-w-3xl leading-relaxed">
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

      {/* Evaluation Panel */}
      <div className="space-y-4">
        <h2 className="font-mono text-xs tracking-wider uppercase text-muted-foreground flex items-center">
          <Shield className="w-4 h-4 mr-2" />
          Quality Gates
        </h2>
        
        <Card className="border-border/50 bg-[#161b22] rounded-sm shadow-none">
          <CardContent className="p-4">
            {loadingEval ? (
              <Skeleton className="h-32 w-full bg-muted/20 rounded-sm" />
            ) : !evaluation ? (
              <div className="text-xs text-muted-foreground">Evaluation not available.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#30363d]">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Overall Eval</span>
                  <Badge variant={evaluation.status === 'PASSED' ? 'default' : 'destructive'} className="font-mono rounded-sm">
                    {evaluation.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {evaluation.qualityGates?.map((gate, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-3 bg-[#0d1117] rounded-sm border border-[#30363d]">
                      <span className="truncate mr-2 font-bold" title={gate.name}>{gate.name}</span>
                      {gate.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                    </div>
                  ))}
                  {(!evaluation.qualityGates || evaluation.qualityGates.length === 0) && (
                    <div className="text-xs text-muted-foreground">No quality gates executed.</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-sm flex flex-col gap-2">
      <div className="flex items-center text-muted-foreground gap-2 text-[10px] uppercase tracking-widest font-bold">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-lg font-bold text-foreground truncate">
        {value}
      </div>
    </div>
  );
}
