import { useGetTokenUsageTimeline, useGetToolUsageStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { formatCost } from "@/lib/format";
import { Wrench, TrendingUp } from "lucide-react";

export default function Analytics() {
  const { data: tokens, isLoading: loadingTokens } = useGetTokenUsageTimeline({ days: 30 });
  const { data: tools, isLoading: loadingTools } = useGetToolUsageStats();

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">Long-term telemetry and usage trends</p>
      </div>

      <Card className="border-border/50 bg-card/30">
        <CardHeader>
          <CardTitle className="text-sm font-mono flex items-center text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 mr-2" />
            Token Expenditure (30d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full mt-4">
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
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10} 
                    tickFormatter={(val) => val.split('T')[0]} 
                  />
                  <YAxis 
                    yAxisId="left" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10} 
                    tickFormatter={(val) => `${val/1000}k`}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="hsl(var(--destructive))" 
                    fontSize={10}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'monospace' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="totalTokens" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorTokens)" 
                    name="Tokens"
                  />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="costUsd" 
                    stroke="hsl(var(--destructive))" 
                    fillOpacity={1} 
                    fill="url(#colorCost)" 
                    name="Cost USD"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/30">
        <CardHeader>
          <CardTitle className="text-sm font-mono flex items-center text-muted-foreground uppercase tracking-wider">
            <Wrench className="w-4 h-4 mr-2" />
            Tool Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full mt-4">
            {loadingTools ? (
              <Skeleton className="w-full h-full bg-muted/20" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tools} layout="vertical" margin={{ left: 100 }}>
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis 
                    dataKey="tool" 
                    type="category" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10} 
                    width={90}
                  />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'monospace' }}
                  />
                  <Bar dataKey="successCount" stackId="a" fill="hsl(var(--primary))" name="Success" />
                  <Bar dataKey="failCount" stackId="a" fill="hsl(var(--destructive))" name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
