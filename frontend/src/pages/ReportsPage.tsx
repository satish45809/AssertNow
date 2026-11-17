import React, { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  BarChart3, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers 
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { useTheme } from '@/providers/ThemeProvider';
import { ExecutionApi } from '@/api/ExecutionApi';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { TestExecution } from '@/types';

export const ReportsPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    ExecutionApi.getExecutions()
      .then(data => setExecutions(data))
      .catch(err => setError(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalRuns = executions.length;
  const passedRuns = executions.filter(e => e.status === 'PASSED').length;
  const globalPassRate = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) : '100.0';
  const avgDuration = totalRuns > 0 
    ? (executions.reduce((acc, e) => acc + (e.durationMs || 0), 0) / totalRuns / 1000).toFixed(1)
    : '0.0';
  const totalStepsEvaluated = executions.reduce((acc, e) => acc + (e.totalSteps || 0), 0);

  const sfCount = executions.length;

  const platformVolumeData = [
    { name: 'Salesforce CRM & Automations', count: sfCount || 1, fill: '#0284c7' },
  ];

  const trendData = [
    { date: 'Run 1', passed: passedRuns, failed: totalRuns - passedRuns },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <Header 
          title="Analytics & Quality Metrics" 
          subtitle="Loading quality engineering analytics..."
        />
        <div className="p-6">
          <LoadingState 
            message="Calculating Quality Metrics..." 
            submessage="Analyzing automated test execution runs and platform stability" 
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-full">
        <Header 
          title="Analytics & Quality Metrics" 
          subtitle="Quality engineering analytics"
        />
        <div className="p-6">
          <ErrorState 
            error={error} 
            onRetry={loadData} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title="Analytics & Quality Metrics" 
        subtitle="Single-platform regression pass rates, assertion stability, and execution telemetry"
      />

      <div className="p-6 space-y-6">
        {/* KPI Summary Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 mb-1">Global Pass Rate</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{globalPassRate}%</div>
            <div className="text-[11px] text-slate-400 mt-1">Across {totalRuns} test runs</div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 mb-1">Avg Execution Duration</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{avgDuration}s</div>
            <div className="text-[11px] text-slate-400 mt-1">Single-platform test duration</div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 mb-1">Assertions Evaluated</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-sky-400 font-mono">{totalStepsEvaluated}</div>
            <div className="text-[11px] text-slate-400 mt-1">SObject & field assertions</div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 mb-1">Active Fleet Scope</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono">100%</div>
            <div className="text-[11px] text-slate-400 mt-1">Verified connection health</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Execution Volume by Platform (Single-Platform Testing) */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Execution Volume by Platform</h3>
                <p className="text-xs text-slate-500">Dedicated single-platform testing suites</p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformVolumeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis type="number" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} width={180} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                      borderColor: isDark ? '#334155' : '#e2e8f0', 
                      borderRadius: '10px', 
                      fontSize: '11px',
                      color: isDark ? '#ffffff' : '#0f172a',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }} 
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Root Cause Taxonomy */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quality Engineering Failure Taxonomies</h3>
            <p className="text-xs text-slate-500">Automated classification of assertion rejections</p>
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Salesforce Validation Rule Violation</span>
                  <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">Standard Error</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">Required fields or custom validation rule returned FIELD_CUSTOM_VALIDATION_EXCEPTION.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>CPQ Pricing Engine Calculation Mismatch</span>
                  <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">Assertion Fail</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">Quote line net amount or discount percentage did not match expected price rules.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Record Locking / Row Lock Contention</span>
                  <span className="text-sky-600 dark:text-sky-400 font-mono font-bold">UNABLE_TO_LOCK_ROW</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">Concurrent DML operations on parent Account during simultaneous batch test execution.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
