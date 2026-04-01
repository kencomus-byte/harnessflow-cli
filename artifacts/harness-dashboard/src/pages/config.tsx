import { useGetConfig } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";

export default function Config() {
  const { data: config, isLoading } = useGetConfig();

  return (
    <div className="space-y-6 fade-in h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">Configuration</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">Active .harness.yaml settings</p>
      </div>

      <Card className="border-border/50 bg-card/30 flex-1 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border/50 bg-card/50 flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">harness.yaml</span>
        </div>
        <div className="p-4 flex-1 overflow-auto bg-background/50">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3 bg-muted/20" />
              <Skeleton className="h-4 w-1/4 bg-muted/20" />
              <Skeleton className="h-4 w-1/2 bg-muted/20" />
            </div>
          ) : (
            <pre className="font-mono text-xs text-primary/90 leading-relaxed">
              {JSON.stringify(config, null, 2)}
            </pre>
          )}
        </div>
      </Card>
    </div>
  );
}
