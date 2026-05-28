import { Link, useLocation } from "wouter";
import { useHealthCheck } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import {
  Database,
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  Settings,
  CheckCircle2,
  AlertCircle,
  MonitorPlay,
  ShoppingCart,
  Box,
  LogOut,
  Clock,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthState } from "@/hooks/use-auth";

interface LayoutProps {
  children: React.ReactNode;
  auth: AuthState;
  onLogout: () => Promise<void>;
}

function useSessionTimer(expiresAt: string | null): string {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!expiresAt) { setDisplay(""); return; }

    function update() {
      const remaining = new Date(expiresAt!).getTime() - Date.now();
      if (remaining <= 0) { setDisplay("Expired"); return; }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setDisplay(`${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return display;
}

export function Layout({ children, auth, onLogout }: LayoutProps) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  const timeRemaining = useSessionTimer(auth.expiresAt);
  const [loggingOut, setLoggingOut] = useState(false);

  const isWarning = auth.expiresAt
    ? new Date(auth.expiresAt).getTime() - Date.now() < 60 * 60 * 1000
    : false;

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "New Import", href: "/import", icon: UploadCloud },
    { name: "Create Order", href: "/orders/new", icon: ShoppingCart },
    { name: "Create Product", href: "/products/new", icon: Box },
    { name: "Live Monitor", href: "/monitor", icon: MonitorPlay },
    { name: "Templates", href: "/templates", icon: FileSpreadsheet },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    await onLogout();
    setLoggingOut(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border text-sidebar-foreground">
          <Database className="w-5 h-5 mr-3 text-sidebar-primary" />
          <span className="font-semibold text-lg tracking-tight">BC Importer</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}
              >
                <item.icon className={`mr-3 h-4 w-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User + Timer + Logout */}
        <div className="p-4 border-t border-sidebar-border space-y-3">
          {/* User badge */}
          <div className="flex items-center gap-2 px-1">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-medium text-sidebar-foreground">{auth.userId}</span>
          </div>

          {/* Session timer */}
          {timeRemaining && (
            <div className={`flex items-center gap-2 px-1 text-xs rounded-md ${isWarning ? "text-amber-400" : "text-sidebar-foreground/60"}`}>
              <Clock className={`w-3 h-3 shrink-0 ${isWarning ? "text-amber-400" : ""}`} />
              <span>Session: {timeRemaining}</span>
            </div>
          )}

          {/* API status */}
          <div className="flex items-center text-xs text-sidebar-foreground/60 px-1">
            {health?.status === "ok" ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 mr-2 text-destructive" />
            )}
            API: {health?.status || "Checking..."}
          </div>

          {/* Logout button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 text-xs h-8"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            {loggingOut ? "Logging out..." : "Log Out"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-8 justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            {navigation.find((n) => n.href === location)?.name ||
              (location.startsWith("/jobs/") ? "Job Detail" : "BC Importer")}
          </h1>
          <div className="flex items-center gap-4">
            {isWarning && timeRemaining && (
              <span className="text-xs text-amber-400 font-medium">
                ⚠ Session expires in {timeRemaining}
              </span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background p-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
