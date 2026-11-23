import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  ChevronRight, 
  Layers,
  Terminal,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ExportLogsButton } from '@/components/ExportLogsButton';
import { ExecutionApi } from '@/api/ExecutionApi';
import { ErrorState } from '@/components/ErrorState';
import { TestExecution } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const ExecutionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchExecutions = () => {
    setIsLoading(true);
    setError(null);
    ExecutionApi.getExecutions()
      .then(data => setExecutions(data))
      .catch(err => setError(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchExecutions();
  }, []);

  const filtered = executions.filter(e => {
    const matchStatus = statusFilter === 'ALL' || e.status === statusFilter;
    const matchSearch = e.workflowName.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title="Test Runs & Execution Observability" 
        subtitle="Detailed execution timelines, step assertions, and live worker logs"
        actions={
          <div className="flex items-center gap-2">
            <ExportLogsButton label="Export All Logs" />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchExecutions}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filter bar */}
        <Card className="p-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-1.5">
              {['ALL', 'PASSED', 'FAILED', 'RUNNING'].map(st => (
                <Button
                  key={st}
                  variant={statusFilter === st ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter(st)}
                  className="font-mono text-xs h-8 px-3"
                >
                  {st}
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input 
                type="text" 
                placeholder="Search by run ID or workflow..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs font-medium"
              />
            </div>
          </div>
        </Card>

        {/* Executions Table with Loading and Error States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px]">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
            <span className="text-xs text-slate-500 font-mono">Loading execution traces from backend...</span>
          </div>
        ) : error ? (
          <ErrorState title="Failed to Load Executions" error={error} onRetry={fetchExecutions} />
        ) : filtered.length === 0 ? (
          <Card className="text-center p-12 border-dashed">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Executions Recorded</h4>
            <p className="text-xs text-slate-500 mt-1">Run an automated suite in Workflow Studio to see live traces here.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0 border">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80">
                <TableRow>
                  <TableHead className="py-3 px-4 font-semibold font-mono text-[11px]">Verdict</TableHead>
                  <TableHead className="py-3 px-4 font-semibold font-mono text-[11px]">Run ID</TableHead>
                  <TableHead className="py-3 px-4 font-semibold font-mono text-[11px]">Workflow</TableHead>
                  <TableHead className="py-3 px-4 font-semibold font-mono text-[11px]">Environments</TableHead>
                  <TableHead className="py-3 px-4 font-semibold font-mono text-[11px]">Steps</TableHead>
                  <TableHead className="py-3 px-4 font-semibold font-mono text-[11px]">Duration</TableHead>
                  <TableHead className="py-3 px-4 font-semibold font-mono text-[11px]">Trigger</TableHead>
                  <TableHead className="py-3 px-4 font-semibold font-mono text-[11px] text-right">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(exec => (
                  <TableRow 
                    key={exec.id}
                    onClick={() => navigate(`/executions/${exec.id}`)}
                    className="cursor-pointer group"
                  >
                    <TableCell className="py-3.5 px-4">
                      <Badge 
                        variant={exec.status === 'PASSED' ? 'success' : 'destructive'}
                        className="gap-1.5 font-mono text-[10px]"
                      >
                        {exec.status === 'PASSED' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                        {exec.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 font-medium">
                      {exec.id}
                    </TableCell>

                    <TableCell className="py-3.5 px-4 font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {exec.workflowName}
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">v{exec.workflowVersion}</span>
                    </TableCell>

                    <TableCell className="py-3.5 px-4">
                      <Badge variant="outline" className="font-mono text-[9px] uppercase bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
                        Salesforce
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {exec.passedSteps || exec.totalSteps}/{exec.totalSteps}
                    </TableCell>

                    <TableCell className="py-3.5 px-4 font-mono text-slate-500">
                      {(exec.durationMs / 1000).toFixed(1)}s
                    </TableCell>

                    <TableCell className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                      {exec.triggerSource || 'MANUAL'}
                    </TableCell>

                    <TableCell className="py-3.5 px-4 text-right text-slate-500 font-mono text-[11px]">
                      {exec.completedAt ? new Date(exec.completedAt).toLocaleTimeString() : 'In Progress'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
};
