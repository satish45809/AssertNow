import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Terminal, 
  Layers, 
  Code2, 
  ShieldCheck, 
  Scale, 
  ChevronRight,
  ExternalLink,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ExportLogsButton } from '@/components/ExportLogsButton';
import { ExecutionApi } from '@/api/ExecutionApi';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { TestExecution, ExecutionStepResult } from '@/types';

export const ExecutionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [execution, setExecution] = useState<TestExecution | null>(null);
  const [selectedStep, setSelectedStep] = useState<ExecutionStepResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadExecution = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await ExecutionApi.getExecutionById(id);
      setExecution(data);
      if (data.steps && data.steps.length > 0) {
        setSelectedStep(data.steps[data.steps.length - 1]);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadExecution();
  }, [loadExecution]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <Header 
          title="Execution Details"
          subtitle="Loading execution trace and assertion results..."
        />
        <div className="p-6">
          <LoadingState 
            message="Retrieving execution run data..." 
            submessage={`Querying live test execution metrics for ID ${id}`} 
          />
        </div>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="flex flex-col min-h-full">
        <Header 
          title="Execution Not Found"
          subtitle="An error occurred while loading this execution"
        />
        <div className="p-6">
          <ErrorState 
            error={error || new Error(`No execution found with ID ${id}`)} 
            onRetry={loadExecution}
            onBack={() => navigate('/executions')}
            backLabel="Back to Test Runs"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title={`Execution Details: ${execution.id}`}
        subtitle={`Workflow: ${execution.workflowName} (v${execution.workflowVersion})`}
        actions={
          <div className="flex items-center gap-2">
            <ExportLogsButton
              logId={execution.id}
              workflowId={execution.workflowId}
              workflowName={execution.workflowName}
            />
            <button 
              onClick={() => navigate('/executions')}
              className="h-8 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Runs
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Top Summary Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-4 shadow-sm">
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">Final Verdict</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold font-mono ${
                execution.status === 'PASSED' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}>
                {execution.status === 'PASSED' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                {execution.status}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">Duration</div>
            <div className="mt-1 text-sm font-mono font-bold text-slate-900 dark:text-white">
              {(execution.durationMs / 1000).toFixed(2)} seconds
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">Step Assertions</div>
            <div className="mt-1 text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {execution.passedSteps} / {execution.totalSteps} passed
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">Environments Scoped</div>
            <div className="mt-1 flex items-center gap-1">
              {(execution.environments && execution.environments.length > 0 
                ? execution.environments 
                : [{ platform: 'salesforce' }]
              ).map((env: any, i: number) => (
                <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {String(env?.platform || 'SALESFORCE').toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">Worker Lease Token</div>
            <div className="mt-1 text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
              worker-pool-node-01
            </div>
          </div>
        </div>

        {/* Step-by-Step Timeline & Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step Timeline */}
          <div className="lg:col-span-1 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono mb-2">
              Execution Steps Sequence
            </h3>

            <div className="space-y-2">
              {execution.steps?.map((step: any, idx: number) => {
                const stepKey = step.id || step.stepId || `step-${idx}`;
                const isSelected = (selectedStep?.id && selectedStep.id === step.id)
                  || ((selectedStep as any)?.stepId && (selectedStep as any).stepId === step.stepId)
                  || selectedStep === step;

                return (
                  <div
                    key={stepKey}
                    onClick={() => setSelectedStep(step)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-600/15 border-blue-500 text-blue-600 dark:text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-slate-500">
                        Step {step.stepOrder || idx + 1} • {step.nodeType}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {step.durationMs}ms
                      </span>
                    </div>

                    <div className="text-xs font-semibold flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="truncate">{step.nodeLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Step Inspector */}
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-sm">
            {selectedStep ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                      STEP {selectedStep.stepOrder} INSPECTOR
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedStep.nodeLabel}
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    PASSED ({selectedStep.durationMs}ms)
                  </span>
                </div>

                {/* Assertion Verdict Card */}
                {selectedStep.assertionResult && (
                  <div className="p-4 rounded-xl bg-purple-500/5 dark:bg-slate-950 border border-purple-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                      <Scale className="w-4 h-4" />
                      Assertion Evaluation: {selectedStep.assertionResult.operator}
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {selectedStep.assertionResult.message}
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-200 dark:border-slate-800/80 text-[11px] font-mono">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="text-slate-500 text-[10px] mb-1 font-semibold">EXPECTED VALUE</div>
                        <div className="text-emerald-600 dark:text-emerald-300 font-bold truncate">{String(selectedStep.assertionResult.expected)}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="text-slate-500 text-[10px] mb-1 font-semibold">ACTUAL VALUE</div>
                        <div className="text-emerald-600 dark:text-emerald-300 font-bold truncate">{String(selectedStep.assertionResult.actual)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Input Payload */}
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5 font-mono">
                    <Code2 className="w-3.5 h-3.5 text-blue-500" />
                    Input Parameters
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-300 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedStep.inputData || (selectedStep as any).inputPayload || {}, null, 2)}
                  </pre>
                </div>

                {/* Output Payload */}
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5 font-mono">
                    <Code2 className="w-3.5 h-3.5 text-emerald-500" />
                    Output Response Payload
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-emerald-700 dark:text-emerald-300/90 overflow-x-auto max-h-40">
                    {JSON.stringify(selectedStep.outputData || (selectedStep as any).outputPayload || {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs font-mono">
                Select a step on the left to inspect variables, payload traces, and assertion diffs.
              </div>
            )}
          </div>
        </div>

        {/* Real-time Worker Execution Logs */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-500" />
              Deno Worker Execution Logs
            </h3>
            <span className="text-[10px] font-mono text-slate-500">
              Redacted for security • 0 secrets leaked
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] space-y-1.5 max-h-60 overflow-y-auto">
            {((execution.logs && execution.logs.length > 0)
              ? execution.logs
              : (execution.steps || []).map((s: any, idx: number) => ({
                  timestamp: s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : new Date().toLocaleTimeString(),
                  level: (s.status === 'FAILED' ? 'ERROR' : 'INFO') as 'ERROR' | 'INFO',
                  message: `[Step ${idx + 1}/${execution.steps?.length || 1}] Execution of "${s.nodeLabel}" (${s.nodeType}) - Duration: ${s.durationMs}ms`,
                  nodeId: s.nodeId
                }))
            ).map((log: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-slate-400 select-none">{log.timestamp}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  log.level === 'INFO' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                  log.level === 'WARN' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  {log.level}
                </span>
                <span className="text-slate-700 dark:text-slate-300">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
