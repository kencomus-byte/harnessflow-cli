import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, Settings, List, BarChart3, Radio } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";
import { useEffect } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({ query: { refetchInterval: 10000 } });

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/sessions", label: "Sessions", icon: List },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/config", label: "Config", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col z-10">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <Activity className="w-5 h-5 text-primary mr-2" />
          <span className="font-mono font-bold tracking-tight text-foreground">HarnessFlow</span>
        </div>
        
        <div className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  active 
                    ? "bg-primary/10 text-primary border-l-2 border-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent"
                }`}>
                  <item.icon className="w-4 h-4 mr-3" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-border">
          <div className="flex items-center text-xs font-mono">
            <Radio className={`w-3 h-3 mr-2 ${health ? 'text-green-500' : 'text-red-500 animate-pulse'}`} />
            <span className="text-muted-foreground">
              {health ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
