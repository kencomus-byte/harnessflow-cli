import { useGetAnalyticsSummary, useGetTokenUsageTimeline, useGetRecentActivity } from "@workspace/api-client-react";
import { formatCost, formatDuration, formatRelative } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Activity, Cpu, CircleDollarSign, Clock } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary();
  const { data: tokens, isLoading: loadingTokens } = useGetTokenUsageTimeline({ days: 7 });
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity({ limit: 10 });

  return (
    <div className="space-y-8 fade-in h-full">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1 text-xs">System Overview & Diagnostics</p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
        <Card className="col-span-1 lg:col-span-2 border-border/50 bg-[#161b22] rounded-md shadow-none">
          <CardHeader className="py-4">
            <CardTitle className="text-xs flex items-center text-muted-foreground uppercase tracking-wider">
              <Activity className="w-4 h-4 mr-2 text-primary" />
              Token Velocity (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {loadingTokens ? (
                <Skeleton className="w-full h-full bg-muted/20 rounded-sm" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tokens}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'monospace', fontSize: '12px' }}
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

        <Card className="col-span-1 border-border/50 bg-[#161b22] rounded-md shadow-none flex flex-col">
          <CardHeader className="py-4">
            <CardTitle className="text-xs flex items-center text-muted-foreground uppercase tracking-wider">
              <Clock className="w-4 h-4 mr-2" />
              System Telemetry
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto max-h-[250px] pr-2 custom-scrollbar">
            {loadingActivity ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full bg-muted/20 rounded-sm" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {activity?.map((event, i) => (
                  <div key={i} className="flex items-start text-xs border-l-2 border-border pl-3 pb-3 relative last:pb-0">
                    <div className="absolute w-2 h-2 rounded-full bg-muted-foreground -left-[5px] top-1 ring-4 ring-[#161b22]"></div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground truncate mr-2">
                          {formatRelative(event.ts)}
                        </span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 bg-[#0d1117] text-muted-foreground border border-[#30363d] rounded-sm shrink-0">
                          {event.type}
                        </span>
                      </div>
                      <p className="text-foreground leading-tight truncate">
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
    <Card className={`border-border/50 shadow-none rounded-md ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-[#161b22]'}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 py-4">
        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold tracking-tight ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {value ?? <Skeleton className="h-7 w-24 bg-muted/20 rounded-sm" />}
        </div>
        {(subtitle || !value) && (
          <div className="text-[10px] text-muted-foreground mt-1">
            {value ? subtitle : <Skeleton className="h-3 w-16 bg-muted/20 rounded-sm" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
