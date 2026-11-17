import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  ArrowUpRight, 
  TrendingUp, 
  Activity, 
  ChevronRight, 
  ShieldCheck, 
  Zap, 
  Plus 
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { SalesforceApi } from '@/api/SalesforceApi';
import { WorkflowApi } from '@/api/WorkflowApi';
import { ExecutionApi } from '@/api/ExecutionApi';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { IntegrationEnvironment, WorkflowDefinition, TestExecution } from '@/types';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [environments, setEnvironments] = useState<IntegrationEnvironment[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [envs, wfs, execs] = await Promise.all([
        SalesforceApi.getEnvironments(),
        WorkflowApi.getWorkflows(),
        ExecutionApi.getExecutions(),
      ]);
      setEnvironments(envs);
      setWorkflows(wfs);
      setExecutions(execs);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const totalRuns = executions.length;
  const passedCount = executions.filter(e => e.status === 'PASSED').length;
  const passRate = totalRuns > 0 ? ((passedCount / totalRuns) * 100).toFixed(1) : '100.0';

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <Header 
          title="Command Center" 
          subtitle="Operational overview of enterprise quality engineering & automated test runs"
        />
        <div className="p-6">
          <LoadingState 
            message="Loading Command Center Operations..." 
            submessage="Synchronizing connected Salesforce fleet, regression suites, and live test executions" 
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-full">
        <Header 
          title="Command Center" 
          subtitle="Operational overview of enterprise quality engineering"
        />
        <div className="p-6">
          <ErrorState 
            error={error} 
            onRetry={loadDashboardData} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title="Command Center" 
        subtitle="Global operational overview of enterprise quality engineering & automated test executions"
        actions={
          <button 
            onClick={() => setIsLauncherOpen(true)}
            className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/30"
          >
            <Zap className="w-3.5 h-3.5" />
            Launch Studio
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Connected Environments</span>
              <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {environments.length}
              <span className="text-xs text-slate-500 font-normal ml-2">org{environments.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {environments.filter(e => (e.status as string) === 'ONLINE' || (e.status as string) === 'ACTIVE').length} online & verified
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Test Pass Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {passRate}%
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>{passedCount} of {totalRuns} passed</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Total Automated Runs</span>
              <Activity className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {totalRuns}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="text-blue-600 dark:text-blue-400 font-medium">{workflows.length}</span>
              <span>active test suites defined</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Test Automation Quota</span>
              <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {totalRuns} / 5,000
            </div>
            <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, Math.max(5, (totalRuns / 5000) * 100))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Fleet & Recent Executions Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connected Enterprise Fleet */}
          <div className="lg:col-span-1 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 p-5 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Connected Environments</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Salesforce CRM Organizations</p>
                </div>
                <button 
                  onClick={() => navigate('/integrations')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Manage <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-3">
                {environments.map((env) => (
                  <div 
                    key={env.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
                    onClick={() => navigate('/integrations')}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                        env.platform === 'salesforce' 
                          ? 'bg-blue-500/10 text-sky-600 dark:text-sky-400 border border-blue-500/20' 
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {env.platform === 'salesforce' ? 'SF' : 'NS'}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
                          {env.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                          {env.environmentType || 'Sandbox'} • {env.authMethod}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium justify-end">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {env.status}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {env.lastVerifiedAt ? new Date(env.lastVerifiedAt).toLocaleDateString() : 'Active'}
                      </div>
                    </div>
                  </div>
                ))}
                {environments.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No environments connected yet.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                Credentials AES-256-GCM Locked
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">Deno WebCrypto</span>
            </div>
          </div>

          {/* Recent Executions Log */}
          <div className="lg:col-span-2 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Automated Test Runs</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Live execution verdicts, timings, and assertion passes</p>
              </div>
              <button 
                onClick={() => navigate('/executions')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
              >
                View all runs <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 font-medium">Workflow</th>
                    <th className="pb-2.5 font-medium">Platform</th>
                    <th className="pb-2.5 font-medium">Steps</th>
                    <th className="pb-2.5 font-medium">Duration</th>
                    <th className="pb-2.5 font-medium text-right">Triggered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {executions.slice(0, 5).map((exec) => (
                    <tr 
                      key={exec.id} 
                      onClick={() => navigate(`/executions/${exec.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium font-mono ${
                          exec.status === 'PASSED' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                          {exec.status === 'PASSED' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-500" />
                          )}
                          {exec.status}
                        </span>
                      </td>

                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1 max-w-[260px]">
                          {exec.workflowName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                          ID: {exec.id} • v{exec.workflowVersion}
                        </div>
                      </td>

                      <td className="py-3 pr-4">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 uppercase font-semibold">
                          {exec.environments?.[0]?.platform || 'SALESFORCE'}
                        </span>
                      </td>

                      <td className="py-3 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {exec.passedSteps}/{exec.totalSteps}
                      </td>

                      <td className="py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {(exec.durationMs / 1000).toFixed(1)}s
                      </td>

                      <td className="py-3 text-slate-400 dark:text-slate-500 font-mono text-[10px] text-right">
                        {exec.startedAt?.split('T')[1]?.slice(0, 5) || 'Recent'} UTC
                      </td>
                    </tr>
                  ))}
                  {executions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">
                        No test runs recorded yet. Launch Workflow Studio to execute a test run.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Featured Automation Workflows */}
        <div className="rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Featured Regression Suites</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Active single-platform quality engineering workflows</p>
            </div>
            <button 
              onClick={() => navigate('/workflows')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
            >
              Browse all {workflows.length} workflows <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workflows.slice(0, 3).map((wf) => (
              <div 
                key={wf.id}
                onClick={() => navigate(`/studio/${wf.id}`)}
                className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase font-semibold">
                      {wf.platform}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">v{wf.version}</span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-1.5">
                    {wf.name}
                  </h3>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {wf.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    {wf.lastExecutionStatus || 'Ready to Run'}
                  </span>
                  <span className="group-hover:translate-x-0.5 transition-transform text-blue-600 dark:text-blue-400 font-medium flex items-center">
                    Open Studio <ArrowUpRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Studio Launcher Modal */}
      {isLauncherOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Launch Workflow Studio</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Select a regression suite to open in the visual canvas, or start fresh</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsLauncherOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Quick Action: Blank Canvas */}
              <div 
                onClick={() => {
                  setIsLauncherOpen(false);
                  navigate('/studio/new');
                }}
                className="p-4 rounded-xl border-2 border-dashed border-blue-500/30 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Initialize New Blank Canvas
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Start from scratch with a clean Start Trigger and build nodes visually
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Launch Blank <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>

              {/* Existing Workflows Section */}
              <div className="pt-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
                  <span>Existing Regression Suites ({workflows.length})</span>
                  <span className="text-[10px] text-slate-500 font-normal">Choose which suite to open</span>
                </div>

                <div className="space-y-2.5">
                  {workflows.map((wf) => (
                    <div 
                      key={wf.id}
                      onClick={() => {
                        setIsLauncherOpen(false);
                        navigate(`/studio/${wf.id}`);
                      }}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-white dark:bg-slate-950/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase ${
                            wf.platform === 'salesforce'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          }`}>
                            {wf.platform}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">v{wf.version}</span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-400">{wf.graph?.nodes?.length || 2} nodes</span>
                          {wf.lastExecutionStatus && (
                            <span className={`text-[10px] font-medium flex items-center gap-1 ml-auto mr-2 ${
                              wf.lastExecutionStatus === 'PASSED' 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : 'text-amber-500'
                            }`}>
                              {wf.lastExecutionStatus === 'PASSED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {wf.lastExecutionStatus} ({wf.lastExecutedAt || 'Recent'})
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {wf.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {wf.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600 group-hover:text-white text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 text-xs">
              <span className="text-slate-500">Need to create custom tags or review execution logs?</span>
              <button
                type="button"
                onClick={() => {
                  setIsLauncherOpen(false);
                  navigate('/workflows');
                }}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
              >
                Browse Test Workflows Hub <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
