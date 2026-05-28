import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetImportJob,
  useGetImportLogs,
  usePauseImportJob,
  useResumeImportJob,
  useRetryFailedRows,
  useUpdateOrderStatuses,
  getGetImportJobQueryKey,
  getGetImportLogsQueryKey,
  getListImportJobsQueryKey,
  getGetImportStatsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, Pause, Play, RefreshCw, Download, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { format } from "date-fns";

const BC_ORDER_STATUSES = [
  { id: 1,  label: "Pending" },
  { id: 7,  label: "Awaiting Payment" },
  { id: 11, label: "Awaiting Fulfillment" },
  { id: 2,  label: "Shipped" },
  { id: 3,  label: "Partially Shipped" },
  { id: 5,  label: "Cancelled" },
  { id: 8,  label: "Awaiting Pickup" },
  { id: 10, label: "Completed" },
  { id: 9,  label: "Awaiting Shipment" },
  { id: 12, label: "Manual Verification Required" },
];

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  running: "bg-primary/10 text-primary border-primary/20",
  paused: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  pending: "bg-muted text-muted-foreground",
};

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedStatusId, setSelectedStatusId] = useState<number>(10);

  const isActive = (status: string) => status === "running" || status === "pending";

  const { data: job, isLoading: jobLoading } = useGetImportJob(jobId!, {
    query: {
      enabled: !!jobId,
      queryKey: getGetImportJobQueryKey(jobId!),
      refetchInterval: (query) => {
        const data = query.state.data as { status: string } | undefined;
        return data && isActive(data.status) ? 2000 : false;
      },
    },
  });

  const { data: logsData, isLoading: logsLoading } = useGetImportLogs(jobId!, {
    query: {
      enabled: !!jobId,
      queryKey: getGetImportLogsQueryKey(jobId!),
      refetchInterval: job && isActive(job.status) ? 2000 : false,
    },
  });

  const pauseMutation = usePauseImportJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetImportJobQueryKey(jobId!) });
        queryClient.invalidateQueries({ queryKey: getListImportJobsQueryKey() });
      },
    },
  });

  const resumeMutation = useResumeImportJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetImportJobQueryKey(jobId!) });
        queryClient.invalidateQueries({ queryKey: getListImportJobsQueryKey() });
      },
    },
  });

  const retryMutation = useRetryFailedRows({
    mutation: {
      onSuccess: (newJob) => {
        queryClient.invalidateQueries({ queryKey: getListImportJobsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetImportStatsQueryKey() });
        setLocation(`/jobs/${newJob.id}`);
      },
    },
  });

  const updateStatusMutation = useUpdateOrderStatuses({
    mutation: {
      onSuccess: (result) => {
        const label = BC_ORDER_STATUSES.find(s => s.id === selectedStatusId)?.label ?? String(selectedStatusId);
        if (result.failed === 0) {
          toast({ title: "Status updated", description: `${result.updated} order${result.updated !== 1 ? "s" : ""} marked as "${label}".` });
        } else {
          toast({
            title: "Partially updated",
            description: `${result.updated} updated, ${result.failed} failed out of ${result.total}.`,
            variant: "destructive",
          });
        }
        queryClient.invalidateQueries({ queryKey: getGetImportLogsQueryKey(jobId!) });
      },
      onError: () => {
        toast({ title: "Update failed", description: "Could not update order statuses.", variant: "destructive" });
      },
    },
  });

  const toggleRowExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progressPct = job && job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Job not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight capitalize">{job.type} Import</h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={STATUS_COLORS[job.status] ?? ""}>
            {job.status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {job.status}
          </Badge>
          {job.status === "running" && (
            <Button
              data-testid="button-pause"
              variant="outline"
              size="sm"
              onClick={() => pauseMutation.mutate({ jobId: jobId! })}
              disabled={pauseMutation.isPending}
            >
              <Pause className="w-4 h-4 mr-1" /> Pause
            </Button>
          )}
          {job.status === "paused" && (
            <Button
              data-testid="button-resume"
              variant="outline"
              size="sm"
              onClick={() => resumeMutation.mutate({ jobId: jobId! })}
              disabled={resumeMutation.isPending}
            >
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
          )}
          {(job.status === "completed" || job.status === "failed") && job.failedRows > 0 && (
            <Button
              data-testid="button-retry-failed"
              variant="outline"
              size="sm"
              onClick={() => retryMutation.mutate({ jobId: jobId! })}
              disabled={retryMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Retry Failed
            </Button>
          )}
          {(job.status === "completed" || job.status === "failed") && job.failedRows > 0 && (
            <a href={`/api/imports/${jobId}/error-report`} download>
              <Button data-testid="button-download-errors" variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" /> Error Report
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Order Status Update — only for completed order imports */}
      {job.type === "orders" && job.status === "completed" && job.successRows > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tag className="w-4 h-4 text-primary" />
                <span>Update Order Status in BigCommerce</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <select
                  value={selectedStatusId}
                  onChange={e => setSelectedStatusId(Number(e.target.value))}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring flex-1 max-w-xs"
                >
                  {BC_ORDER_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => updateStatusMutation.mutate({ jobId: jobId!, data: { statusId: selectedStatusId } })}
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Updating...</>
                    : <><Tag className="w-3.5 h-3.5 mr-1.5" /> Apply to {job.successRows} order{job.successRows !== 1 ? "s" : ""}</>
                  }
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Total Rows</p>
            <p className="text-2xl font-bold font-mono">{job.totalRows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Processed</p>
            <p className="text-2xl font-bold font-mono">{job.processedRows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Success</p>
            <p className="text-2xl font-bold font-mono text-green-500">{job.successRows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Failed</p>
            <p className="text-2xl font-bold font-mono text-destructive">{job.failedRows}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              {isActive(job.status) ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing row {job.processedRows} of {job.totalRows}...
                </span>
              ) : (
                <span>
                  Completed {format(new Date(job.createdAt), "MMM d, yyyy HH:mm")}
                  {job.completedAt && ` — finished ${format(new Date(job.completedAt), "HH:mm:ss")}`}
                </span>
              )}
            </span>
            <span className="font-mono font-medium">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">
            Import Logs
            {logsData && <span className="text-muted-foreground font-normal text-sm ml-2">({logsData.total} entries)</span>}
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 border-t border-b border-border">
              <tr>
                <th className="px-4 py-3 w-16">Row</th>
                <th className="px-4 py-3 w-24">Status</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3 w-32 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading logs...
                  </td>
                </tr>
              ) : logsData?.logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {isActive(job.status) ? "Waiting for first rows to be processed..." : "No log entries yet"}
                  </td>
                </tr>
              ) : (
                logsData?.logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      data-testid={`log-row-${log.rowNumber}`}
                      className={`border-b border-border transition-colors ${log.status === "error" ? "hover:bg-destructive/5" : "hover:bg-muted/20"}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{log.rowNumber}</td>
                      <td className="px-4 py-3">
                        {log.status === "success" && (
                          <span className="flex items-center gap-1.5 text-green-500 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> success
                          </span>
                        )}
                        {log.status === "error" && (
                          <span className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                            <XCircle className="w-3.5 h-3.5" /> error
                          </span>
                        )}
                        {log.status === "processing" && (
                          <span className="flex items-center gap-1.5 text-primary text-xs font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> processing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {log.status === "error" && log.payload && (
                            <button
                              onClick={() => toggleRowExpand(log.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {expandedRows.has(log.id)
                                ? <ChevronDown className="w-3.5 h-3.5" />
                                : <ChevronRight className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                          <span className={log.status === "error" ? "text-destructive" : ""}>{log.message}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                        {format(new Date(log.createdAt), "HH:mm:ss")}
                      </td>
                    </tr>
                    {expandedRows.has(log.id) && log.payload && (
                      <tr key={`${log.id}-payload`} className="border-b border-border bg-muted/30">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="text-xs font-mono bg-muted/50 border border-border rounded p-3 overflow-auto max-h-32 text-muted-foreground">
                            {(() => {
                              try { return JSON.stringify(JSON.parse(log.payload!), null, 2); }
                              catch { return log.payload; }
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
