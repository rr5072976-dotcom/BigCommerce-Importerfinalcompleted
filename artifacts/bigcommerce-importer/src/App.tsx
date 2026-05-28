import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import ImportWizard from "@/pages/import-wizard";
import JobDetail from "@/pages/job-detail";
import Templates from "@/pages/templates";
import Settings from "@/pages/settings";
import Monitor from "@/pages/monitor";
import ManualOrder from "@/pages/manual-order";
import ManualProduct from "@/pages/manual-product";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import { useAuth } from "@/hooks/use-auth";

// Global fetch interceptor — adds X-Session-Token to all /api/ requests
const _originalFetch = window.fetch.bind(window);
window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.includes("/api/")) {
    const stored = (() => { try { const r = localStorage.getItem("bc_auth"); return r ? (JSON.parse(r) as { token?: string }).token : null; } catch { return null; } })();
    if (stored) {
      const headers = new Headers((init as RequestInit)?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has("X-Session-Token")) headers.set("X-Session-Token", stored);
      return _originalFetch(input, { ...init, headers });
    }
  }
  return _originalFetch(input, init);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if ((error as { status?: number })?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

function Router() {
  const { auth, login, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login onLogin={login} />;
  }

  return (
    <Layout auth={auth} onLogout={logout}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/import" component={ImportWizard} />
        <Route path="/monitor" component={Monitor} />
        <Route path="/jobs/:jobId" component={JobDetail} />
        <Route path="/templates" component={Templates} />
        <Route path="/settings" component={Settings} />
        <Route path="/orders/new" component={ManualOrder} />
        <Route path="/products/new" component={ManualProduct} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
