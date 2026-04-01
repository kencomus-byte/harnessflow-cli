import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IDEShell } from "@/components/layout";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <IDEShell />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
