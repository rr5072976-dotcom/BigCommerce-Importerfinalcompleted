import { useGetImportStats, useListImportJobs, getListImportJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowRight, Box, Users, ShoppingCart, PlayCircle, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetImportStats();
  const { data: jobs, isLoading: jobsLoading } = useListImportJobs({ query: { refetchInterval: 5000, queryKey: getListImportJobsQueryKey() } });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
      case 'failed': return 'bg-destructive/10 text-destructive hover:bg-destructive/20';
      case 'running': return 'bg-primary/10 text-primary hover:bg-primary/20';
      case 'paused': return 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'products': return <Box className="w-4 h-4" />;
      case 'customers': return <Users className="w-4 h-4" />;
      case 'orders': return <ShoppingCart className="w-4 h-4" />;
      default: return <Box className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overview of your BigCommerce imports</p>
        </div>
        <Link href="/import">
          <Button>
            <PlayCircle className="w-4 h-4 mr-2" />
            Start New Import
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{statsLoading ? '-' : (stats as any)?.totalOrdersImported?.toLocaleString() ?? '0'}</div>
            <p className="text-xs text-muted-foreground mt-1">orders imported</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{statsLoading ? '-' : (stats as any)?.totalCustomersImported?.toLocaleString() ?? '0'}</div>
            <p className="text-xs text-muted-foreground mt-1">customers imported</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rows Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{statsLoading ? '-' : stats?.totalRows?.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-green-500">
              {statsLoading || !stats?.totalRows ? '-' : `${((stats.totalSuccess / stats.totalRows) * 100).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats?.totalSuccess.toLocaleString()} successful rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-destructive">{statsLoading ? '-' : stats?.totalFailed?.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Recent Jobs</h3>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium">Job ID</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Progress</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading jobs...
                    </td>
                  </tr>
                ) : jobs?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No import jobs found.
                    </td>
                  </tr>
                ) : (
                  jobs?.map((job) => (
                    <tr key={job.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">{job.id.substring(0, 8)}...</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 capitalize">
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
                        <div className="font-mono text-xs">
                          {job.processedRows} / {job.totalRows}
                        </div>
                        <div className="w-full bg-muted h-1.5 rounded-full mt-1 overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-500" 
                            style={{ width: `${job.totalRows ? (job.processedRows / job.totalRows) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(job.createdAt), "MMM d, HH:mm")}
                      </td>
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