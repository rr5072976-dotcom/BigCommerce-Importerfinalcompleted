import { useGetImportStats, useListImportJobs, getListImportJobsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight, Box, Users, ShoppingCart, PlayCircle, Loader2,
  TrendingUp, XCircle, UploadCloud, FileSpreadsheet, Store,
  CheckCircle2, AlertTriangle,
} from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetImportStats();
  const { data: jobs, isLoading: jobsLoading } = useListImportJobs({ query: { refetchInterval: 5000, queryKey: getListImportJobsQueryKey() } });
  const { data: storesData, isLoading: storesLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const res = await fetch("/api/stores");
      if (!res.ok) throw new Error("Failed to load stores");
      return res.json() as Promise<{ stores: Array<{ id: string; storeHash: string; storeName: string }> }>;
    },
  });

  const s = stats as any;
  const stores = storesData?.stores ?? [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "failed": return "bg-destructive/10 text-destructive hover:bg-destructive/20";
      case "running": return "bg-primary/10 text-primary hover:bg-primary/20";
      case "paused": return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "products": return <Box className="w-4 h-4" />;
      case "customers": return <Users className="w-4 h-4" />;
      case "orders": return <ShoppingCart className="w-4 h-4" />;
      default: return <Box className="w-4 h-4" />;
    }
  };

  const successRate = s?.totalRows > 0 ? ((s.totalSuccess / s.totalRows) * 100).toFixed(1) : null;
  const recentJobs = (jobs ?? []).slice(0, 8);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            {s?.lastImportAt
              ? `Last import ${formatDistanceToNow(new Date(s.lastImportAt), { addSuffix: true })}`
              : "No imports yet"}
          </p>
        </div>
        <Link href="/import">
          <Button>
            <PlayCircle className="w-4 h-4 mr-2" />
            Start New Import
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
            <Box className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (s?.totalProductsImported ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">imported</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            <Users className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (s?.totalCustomersImported ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">imported</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
            <ShoppingCart className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (s?.totalOrdersImported ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">imported</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rows</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (s?.totalRows ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">across {s?.totalJobs ?? 0} jobs</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-500">
              {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : successRate ? `${successRate}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{(s?.totalSuccess ?? 0).toLocaleString()} successful</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Rows</CardTitle>
            <XCircle className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${(s?.totalFailed ?? 0) > 0 ? "text-destructive" : ""}`}>
              {statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (s?.totalFailed ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Store Status */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link href="/import">
              <Button variant="outline" className="w-full justify-start h-12 gap-3">
                <UploadCloud className="w-4 h-4 text-primary" />
                <span className="text-sm">New Import</span>
              </Button>
            </Link>
            <Link href="/orders/new">
              <Button variant="outline" className="w-full justify-start h-12 gap-3">
                <ShoppingCart className="w-4 h-4 text-green-500" />
                <span className="text-sm">Create Order</span>
              </Button>
            </Link>
            <Link href="/products/new">
              <Button variant="outline" className="w-full justify-start h-12 gap-3">
                <Box className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Create Product</span>
              </Button>
            </Link>
            <Link href="/templates">
              <Button variant="outline" className="w-full justify-start h-12 gap-3">
                <FileSpreadsheet className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Templates</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Connected Stores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4" />
              Connected Stores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {storesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading stores...
              </div>
            ) : stores.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  No stores connected yet
                </div>
                <Link href="/settings">
                  <Button size="sm" variant="outline" className="w-full">Go to Settings</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {stores.map((store: any) => (
                  <div key={store.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-sm font-medium">{store.storeName || store.storeHash}</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{store.storeHash}</span>
                  </div>
                ))}
                <Link href="/settings">
                  <Button size="sm" variant="ghost" className="w-full mt-1 text-xs text-muted-foreground">
                    Manage Stores
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Recent Jobs</h3>
          <Link href="/monitor">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Progress</th>
                  <th className="px-6 py-3 font-medium text-right">✓ Success</th>
                  <th className="px-6 py-3 font-medium text-right">✗ Failed</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {jobsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading jobs...
                    </td>
                  </tr>
                ) : recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <UploadCloud className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No import jobs yet.</p>
                      <Link href="/import">
                        <Button size="sm" className="mt-3">Start your first import</Button>
                      </Link>
                    </td>
                  </tr>
                ) : (
                  recentJobs.map((job) => (
                    <tr key={job.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 capitalize font-medium">
                          {getTypeIcon(job.type)}
                          {job.type}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-mono text-xs text-muted-foreground">{job.processedRows}/{job.totalRows}</div>
                        <div className="w-24 bg-muted h-1.5 rounded-full mt-1 overflow-hidden ml-auto">
                          <div
                            className="bg-primary h-full transition-all duration-500"
                            style={{ width: `${job.totalRows ? (job.processedRows / job.totalRows) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-green-500">{job.successRows}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-destructive">{job.failedRows}</td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{format(new Date(job.createdAt), "MMM d, HH:mm")}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/jobs/${job.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
