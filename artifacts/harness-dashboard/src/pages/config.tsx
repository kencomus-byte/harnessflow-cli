import { useGetConfig } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";

export default function Config() {
  const { data: config, isLoading } = useGetConfig();

  return (
    <div className="space-y-6 fade-in h-full flex flex-col pb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuration</h1>
        <p className="text-muted-foreground mt-1 text-xs">Active harness.yaml settings</p>
      </div>

      <Card className="border border-[#30363d] bg-[#161b22] rounded-sm shadow-none flex-1 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-[#30363d] bg-[#0d1117] flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">harness.yaml</span>
        </div>
        <div className="p-4 flex-1 overflow-auto bg-[#0d1117]/50 custom-scrollbar">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/3 bg-muted/20 rounded-sm" />
              <Skeleton className="h-4 w-1/4 bg-muted/20 rounded-sm" />
              <Skeleton className="h-4 w-1/2 bg-muted/20 rounded-sm" />
            </div>
          ) : (
            <pre className="text-xs text-blue-300 leading-relaxed">
              {JSON.stringify(config, null, 2)}
            </pre>
          )}
        </div>
      </Card>
    </div>
  );
}
