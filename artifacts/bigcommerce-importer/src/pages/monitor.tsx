import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Store,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Pause,
  Play,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Download,
  Users,
  Box,
  ShoppingCart,
  Inbox,
} from "lucide-react";

interface SavedStore {
  id: string;
  label: string | null;
  storeHash: string;
  storeName: string | null;
  accessTokenMasked: string | null;
}

interface ImportJob {
  id: string;
  type: string;
  status: string;
  storeHash: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  completedAt: string | null;
}

interface ImportLog {
  id: string;
  rowNumber: number;
  status: string;
  message: string;
  entityId: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; pulse?: boolean }> = {
  running:   { label: "Running",   color: "text-primary border-primary/30 bg-primary/10",         icon: Loader2,      pulse: true },
  pending:   { label: "Pending",   color: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10", icon: Clock,        pulse: true },
  paused:    { label: "Paused",    color: "text-orange-500 border-orange-500/30 bg-orange-500/10", icon: Pause },
  completed: { label: "Done",      color: "text-green-500 border-green-500/30 bg-green-500/10",    icon: CheckCircle2 },
  failed:    { label: "Failed",    color: "text-destructive border-destructive/30 bg-destructive/10", icon: XCircle },
};

const TYPE_ICON: Record<string, React.ElementType> = {
  customers: Users,
  products:  Box,
  orders:    ShoppingCart,
};

function isActive(status: string) {
  return status === "running" || status === "pending";
}

function useSavedStores() {
  return useQuery<{ stores: SavedStore[] }>({
    queryKey: ["stores"],
    queryFn: async () => {
      const res = await fetch("/api/stores");
      if (!res.ok) throw new Error("Failed to load stores");
      return res.json();
    },
    refetchInterval: 15_000,
  });
}

function useAllJobs() {
  return useQuery<ImportJob[]>({
    queryKey: ["monitor-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/imports");
      if (!res.ok) throw new Error("Failed to load jobs");
      return res.json();
    },
    refetchInterval: 2_000,
  });
}

function useJobLogs(jobId: string | null, active: boolean) {
  return useQuery<{ logs: ImportLog[] }>({
    queryKey: ["monitor-logs", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/imports/${jobId}/logs`);
      if (!res.ok) throw new Error("Failed to load logs");
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: active ? 2_000 : false,
    select: (data) => ({ logs: data.logs.slice(-8) }),
  });
}

function usePauseJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/imports/${jobId}/pause`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to pause");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitor-jobs"] }),
  });
}

function useResumeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/imports/${jobId}/resume`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to resume");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitor-jobs"] }),
  });
}

function StorePanel({ store, jobs }: { store: SavedStore; jobs: ImportJob[] }) {
  const [, setLocation] = useLocation();
  const pauseJob = usePauseJob();
  const resumeJob = useResumeJob();

  // Find most recent job for this store
  const storeJobs = jobs
    .filter((j) => j.storeHash === store.storeHash)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeJob = storeJobs.find((j) => isActive(j.status));
  const currentJob = activeJob ?? storeJobs[0] ?? null;
  const jobActive = currentJob ? isActive(currentJob.status) : false;

  const { data: logsData, isLoading: logsLoading } = useJobLogs(currentJob?.id ?? null, jobActive);
  const logs = logsData?.logs ?? [];

  const statusCfg = currentJob ? (STATUS_CONFIG[currentJob.status] ?? STATUS_CONFIG.pending) : null;
  const TypeIcon = currentJob ? (TYPE_ICON[currentJob.type] ?? Box) : null;
  const progress = currentJob && currentJob.totalRows > 0
    ? Math.round((currentJob.processedRows / currentJob.totalRows) * 100)
    : 0;

  const actionPending = pauseJob.isPending || resumeJob.isPending;

  return (
    <Card className="flex flex-col min-h-0 border-border">
      {/* Store header */}
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
              <Store className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">
                {store.label ?? store.storeName ?? store.storeHash}
              </CardTitle>
              <p className="text-xs text-muted-foreground font-mono truncate">{store.storeHash}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {statusCfg && (
              <Badge variant="outline" className={`text-xs gap-1 ${statusCfg.color}`}>
                <statusCfg.icon className={`w-3 h-3 ${statusCfg.pulse ? "animate-spin" : ""}`} />
                {statusCfg.label}
              </Badge>
            )}
            {/* Pause button — shown when running */}
            {currentJob?.status === "running" && (
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 shrink-0 border-orange-500/40 text-orange-500 hover:bg-orange-500/10 hover:text-orange-500"
                disabled={actionPending}
                onClick={() => pauseJob.mutate(currentJob.id)}
                title="Pause import"
              >
                {pauseJob.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
              </Button>
            )}
            {/* Resume button — shown when paused */}
            {currentJob?.status === "paused" && (
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 shrink-0 border-green-500/40 text-green-500 hover:bg-green-500/10 hover:text-green-500"
                disabled={actionPending}
                onClick={() => resumeJob.mutate(currentJob.id)}
                title="Resume import"
              >
                {resumeJob.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1 min-h-0 pt-0">
        {!currentJob ? (
          /* No imports yet */
          <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
            <Inbox className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No imports yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Start a new import for this store</p>
          </div>
        ) : (
          <>
            {/* Job type + meta */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                {TypeIcon && <TypeIcon className="w-3.5 h-3.5" />}
                <span className="capitalize font-medium text-foreground">{currentJob.type}</span>
                <span>import</span>
              </div>
              <button
                onClick={() => setLocation(`/jobs/${currentJob.id}`)}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                Detail <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {currentJob.processedRows} / {currentJob.totalRows > 0 ? currentJob.totalRows : "?"} rows
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-muted/40 border border-border/50 px-2.5 py-2 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-bold text-foreground">{currentJob.totalRows}</p>
              </div>
              <div className="rounded-md bg-green-500/5 border border-green-500/20 px-2.5 py-2 text-center">
                <p className="text-xs text-green-500">Success</p>
                <p className="text-sm font-bold text-green-500">{currentJob.successRows}</p>
              </div>
              <div className="rounded-md bg-destructive/5 border border-destructive/20 px-2.5 py-2 text-center">
                <p className="text-xs text-destructive">Failed</p>
                <p className="text-sm font-bold text-destructive">{currentJob.failedRows}</p>
              </div>
            </div>

            {/* Error report download — only when there are failures */}
            {currentJob.failedRows > 0 && (
              <a
                href={`/api/imports/${currentJob.id}/error-report`}
                download={`errors-${store.storeHash}-${currentJob.id.slice(0, 8)}.csv`}
                className="flex items-center justify-center gap-1.5 w-full rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                Download {currentJob.failedRows} failed row{currentJob.failedRows !== 1 ? "s" : ""} as CSV
              </a>
            )}

            {/* Logs */}
            <div className="flex-1 min-h-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Logs</p>
                {jobActive && (
                  <RefreshCw className="w-3 h-3 text-muted-foreground/50 animate-spin" />
                )}
              </div>
              <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
                {logsLoading && logs.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading logs…
                  </div>
                ) : logs.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    Waiting for rows…
                  </div>
                ) : (
                  <div className="divide-y divide-border/50 max-h-52 overflow-y-auto">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 px-3 py-2">
                        {log.status === "success" ? (
                          <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                        ) : log.status === "error" ? (
                          <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground shrink-0">Row {log.rowNumber}</span>
                            {log.entityId && (
                              <span className="text-xs font-mono text-primary/70">#{log.entityId}</span>
                            )}
                          </div>
                          <p className="text-xs truncate text-foreground/80">{log.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* All jobs for this store */}
            {storeJobs.length > 1 && (
              <div className="pt-1 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-1.5">
                  {storeJobs.length} total job{storeJobs.length > 1 ? "s" : ""} for this store
                </p>
                <div className="flex flex-wrap gap-1">
                  {storeJobs.slice(0, 5).map((j) => {
                    const cfg = STATUS_CONFIG[j.status];
                    return (
                      <button
                        key={j.id}
                        onClick={() => setLocation(`/jobs/${j.id}`)}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs border ${cfg?.color ?? "text-muted-foreground border-border"} hover:opacity-80 transition-opacity`}
                      >
                        <span className="capitalize">{j.type}</span>
                        <span className="text-muted-foreground/60">
                          {new Date(j.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Monitor() {
  const { data: storesData, isLoading: storesLoading } = useSavedStores();
  const { data: jobs, isLoading: jobsLoading, dataUpdatedAt } = useAllJobs();

  const stores = storesData?.stores ?? [];
  const allJobs = jobs ?? [];
  const anyActive = allJobs.some((j) => isActive(j.status));

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Live Monitor</h2>
          <p className="text-muted-foreground mt-1">
            Real-time import progress across all your stores
            {anyActive && (
              <span className="ml-2 inline-flex items-center gap-1 text-primary text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                Live
              </span>
            )}
          </p>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Store panels */}
      {storesLoading || jobsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading monitor…
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <Store className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No stores configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
            Add stores in Settings to monitor their imports here
          </p>
          <Button size="sm" variant="outline" onClick={() => window.location.assign("/settings")}>
            Go to Settings
          </Button>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            stores.length === 1 ? "grid-cols-1 max-w-md" :
            stores.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
            stores.length === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
            stores.length === 4 ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          }`}
        >
          {stores.map((store) => (
            <StorePanel key={store.id} store={store} jobs={allJobs} />
          ))}
        </div>
      )}

      {/* Summary bar */}
      {allJobs.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{allJobs.length}</span> total jobs
            </div>
            <div>
              <span className="font-medium text-primary">{allJobs.filter(j => isActive(j.status)).length}</span> active
            </div>
            <div>
              <span className="font-medium text-green-500">{allJobs.filter(j => j.status === "completed").length}</span> completed
            </div>
            <div>
              <span className="font-medium text-destructive">{allJobs.filter(j => j.status === "failed").length}</span> failed
            </div>
            <div>
              <span className="font-medium text-foreground">{allJobs.reduce((a, j) => a + j.successRows, 0).toLocaleString()}</span> rows imported total
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
