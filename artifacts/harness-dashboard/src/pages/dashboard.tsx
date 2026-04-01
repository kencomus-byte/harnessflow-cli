import { useGetAnalyticsSummary, useGetTokenUsageTimeline, useGetRecentActivity } from "@workspace/api-client-react";
import { formatCost, formatDuration, formatRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Activity, Cpu, CircleDollarSign, CheckCircle2, XCircle, Clock } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary();
  const { data: tokens, isLoading: loadingTokens } = useGetTokenUsageTimeline({ days: 7 });
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity({ limit: 10 });

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">Cockpit</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">System Overview & Diagnostics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Active Sessions" 
          value={loadingSummary ? null : summary?.runningSessions.toString()} 
          icon={Terminal} 
          subtitle={loadingSummary ? null : `${summary?.totalSessions} total`}
          highlight={summary && summary.runningSessions > 0}
        />
        <StatCard 
          title="Token Consumption" 
          value={loadingSummary ? null : summary?.totalTokens.toLocaleString()} 
          icon={Cpu} 
          subtitle="Lifetime aggregate"
        />
        <StatCard 
          title="Total Cost" 
          value={loadingSummary ? null : formatCost(summary?.totalCostUsd)} 
          icon={CircleDollarSign} 
        />
        <StatCard 
          title="Success Rate" 
          value={loadingSummary ? null : `${((summary?.successRate ?? 0) * 100).toFixed(1)}%`} 
          icon={Activity} 
          subtitle={loadingSummary ? null : `Avg dur: ${formatDuration(summary?.avgDurationMs)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Token Usage Chart */}
        <Card className="col-span-1 lg:col-span-2 bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-mono flex items-center text-muted-foreground uppercase tracking-wider">
              <Activity className="w-4 h-4 mr-2 text-primary" />
              Token Velocity (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {loadingTokens ? (
                <Skeleton className="w-full h-full bg-muted/20" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tokens}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <YAxis 
                      hide 
                      domain={['auto', 'auto']} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'monospace' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                    <Area 
                      type="stepAfter" 
                      dataKey="totalTokens" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorTokens)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="col-span-1 bg-card/50 border-border/50 flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-mono flex items-center text-muted-foreground uppercase tracking-wider">
              <Clock className="w-4 h-4 mr-2" />
              System Telemetry
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-[300px] pr-2">
            {loadingActivity ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-muted/20" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {activity?.map((event, i) => (
                  <div key={i} className="flex items-start text-sm border-l-2 border-border pl-3 pb-4 relative last:pb-0">
                    <div className="absolute w-2 h-2 rounded-full bg-muted-foreground -left-[5px] top-1.5 ring-4 ring-card"></div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatRelative(event.ts)}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-muted text-muted-foreground">
                          {event.type}
                        </span>
                      </div>
                      <p className="text-foreground leading-tight">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, subtitle, highlight = false }: any) {
  return (
    <Card className={`border-border/50 ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card/50'}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-mono font-bold tracking-tight ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {value ?? <Skeleton className="h-8 w-24 bg-muted/20" />}
        </div>
        {(subtitle || !value) && (
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {value ? subtitle : <Skeleton className="h-3 w-16 bg-muted/20" />}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
