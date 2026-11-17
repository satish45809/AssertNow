import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Workflow, 
  Plus, 
  Search, 
  PlayCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  Tag, 
  Copy, 
  Trash2, 
  MoreVertical,
  Zap,
  RefreshCw
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { WorkflowApi } from '@/api/WorkflowApi';
import { ErrorState } from '@/components/ErrorState';
import { WorkflowDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export const WorkflowListPage: React.FC = () => {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New Workflow form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await WorkflowApi.getWorkflows();
      setWorkflows(data);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const filteredWorkflows = workflows.filter(wf => {
    const matchesSearch = wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          wf.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || wf.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    setIsCreating(true);
    try {
      const newWf = await WorkflowApi.createWorkflow({
        name: newName,
        description: newDesc,
        platform: 'salesforce',
      });

      setIsCreateModalOpen(false);
      navigate(`/studio/${newWf.id}`);
    } catch (err: any) {
      alert(`Workflow Creation Failed: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title="Test Workflows" 
        subtitle="Visual regression workflows, assertions, and live execution suites for Salesforce"
        badge={workflows.length > 0 ? `${workflows.length} Suites` : undefined}
        actions={
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
            className="gap-1.5 shadow-sm shadow-blue-500/30"
          >
            <Plus className="w-3.5 h-3.5" />
            New Workflow
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filter Bar */}
        <Card className="p-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {['all', 'published', 'draft'].map((st) => (
                <Button
                  key={st}
                  variant={statusFilter === st ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatusFilter(st)}
                  className="capitalize text-xs h-8"
                >
                  {st === 'all' ? 'All Statuses' : st}
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input 
                type="text" 
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs font-medium"
              />
            </div>
          </div>
        </Card>

        {/* Workflow Content Grid with Loading & Error States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px]">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
            <span className="text-xs text-slate-500 font-mono">Fetching test suites from backend...</span>
          </div>
        ) : error ? (
          <ErrorState 
            title="Failed to Load Workflows" 
            error={error} 
            onRetry={fetchWorkflows} 
          />
        ) : filteredWorkflows.length === 0 ? (
          <Card className="text-center p-12 border-dashed">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Workflows Found</h4>
            <p className="text-xs text-slate-500 mt-1">Create a new regression workflow to start validating Salesforce automations.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWorkflows.map((wf) => (
              <Card 
                key={wf.id}
                className="hover:border-slate-300 dark:hover:border-slate-700 transition-all p-5 flex flex-col justify-between group space-y-4 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <Badge variant="outline" className="font-mono text-[9px] uppercase bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20">
                      SALESFORCE
                    </Badge>

                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      v{wf.version} • {wf.status}
                    </span>
                  </div>

                  <h3 
                    onClick={() => navigate(`/studio/${wf.id}`)}
                    className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer line-clamp-2 mb-2"
                  >
                    {wf.name}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed mb-3">
                    {wf.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    {wf.graph?.nodes?.length || 2} canvas nodes
                  </span>
                  <Button 
                    onClick={() => navigate(`/studio/${wf.id}`)}
                    variant="secondary"
                    size="sm"
                    className="h-7 px-3 text-xs font-semibold gap-1"
                  >
                    Launch Studio <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Workflow Dialog (shadcn Dialog) */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent onClose={() => setIsCreateModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Create Salesforce Test Workflow</DialogTitle>
            <DialogDescription>
              Define the name and scope of the test suite before building the execution graph.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateWorkflow} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Workflow Title</label>
              <Input 
                type="text" 
                required
                placeholder="e.g. Account Creation & Opportunity Assertion"
                value={newName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Business Scope / Description</label>
              <textarea 
                rows={3}
                placeholder="Describe the Salesforce regression workflow and assertions performed..."
                value={newDesc}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDesc(e.target.value)}
                className="flex w-full rounded-md border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-slate-900 dark:text-slate-100"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating}
                className="gap-1.5"
              >
                {isCreating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isCreating ? 'Creating...' : 'Initialize in Studio'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
