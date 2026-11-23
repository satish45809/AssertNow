/**
 * Test Execution & Assertion API Service
 * Backed by the PostgreSQL workflow_test_logs table via TestLogApi.
 * Single Source of Truth for all test executions and step assertions.
 */

import { TestExecution } from '../types';
import { TestLogApi, BackendTestLog } from './TestLogApi';
import { WorkflowApi } from './WorkflowApi';

function mapLogToExecution(log: BackendTestLog, workflowNameMap: Record<number, string> = {}): TestExecution {
  const steps = Array.isArray(log.step_logs) ? log.step_logs : [];
  const passedSteps = steps.filter((s: any) => s.status === 'PASSED').length;
  const failedSteps = steps.filter((s: any) => s.status === 'FAILED').length;

  const mappedSteps = steps.map((s: any, idx: number) => ({
    id: `step-${idx + 1}`,
    stepId: `step-${idx + 1}`,
    stepOrder: typeof s.step === 'number' ? s.step : idx + 1,
    nodeId: s.key || s.nodeId || `node-${idx + 1}`,
    nodeLabel: s.nodeLabel || s.sobject || `Step ${idx + 1}`,
    nodeType: s.action || s.nodeType || 'ACTION',
    status: s.status as any,
    startedAt: log.started_at,
    completedAt: log.completed_at || log.started_at,
    durationMs: s.durationMs || 100,
    inputData: s.input || s.inputData || {},
    outputData: s.output || s.outputData || {},
    errorMessage: s.error || s.errorMessage,
  }));

  const wfName = log.workflow_id
    ? (workflowNameMap[log.workflow_id] || `Workflow #${log.workflow_id}`)
    : 'Salesforce Workflow';

  return {
    id: String(log.id),
    workflowId: log.workflow_id ? String(log.workflow_id) : 'wf-manual',
    workflowName: wfName,
    workflowVersion: 1,
    organizationId: 'org-enterprise-1',
    triggerSource: (log.trigger_type as any) || 'MANUAL',
    status: log.status,
    startedAt: log.started_at,
    completedAt: log.completed_at || undefined,
    durationMs: log.duration_ms || 0,
    totalSteps: steps.length,
    passedSteps,
    failedSteps,
    errorSummary: log.error_message || undefined,
    environments: [
      {
        platform: 'salesforce',
        environmentName: 'Salesforce Org',
        environmentId: `conn-${log.connection_id || 1}`,
      },
    ],
    steps: mappedSteps,
    logs: mappedSteps.map(s => ({
      timestamp: new Date(log.started_at).toLocaleTimeString(),
      level: s.status === 'FAILED' ? ('ERROR' as const) : ('INFO' as const),
      message: `[Step ${s.stepOrder}] ${s.nodeLabel} (${s.nodeType}): ${s.status}${s.errorMessage ? ` - ${s.errorMessage}` : ''}`,
      nodeId: s.nodeId,
    })),
  };
}

export class ExecutionApi {
  public static async getExecutions(workflowId?: string): Promise<TestExecution[]> {
    const numericWfId = workflowId && !isNaN(Number(workflowId)) ? Number(workflowId) : undefined;
    const logs = await TestLogApi.list({ workflowId: numericWfId, limit: 100 });

    // Try to get workflow names for nice display
    const wfMap: Record<number, string> = {};
    try {
      const wfs = await WorkflowApi.getWorkflows();
      wfs.forEach(w => {
        const numId = Number(w.id);
        if (!isNaN(numId)) wfMap[numId] = w.name;
      });
    } catch {}

    return logs.map(log => mapLogToExecution(log, wfMap));
  }

  public static async getExecutionById(id: string): Promise<TestExecution> {
    const list = await this.getExecutions();
    const found = list.find(e => e.id === id);
    if (!found) {
      throw new Error(`Test run with ID "${id}" was not found.`);
    }
    return found;
  }

  public static async recordCustomExecution(params: {
    workflowId: string;
    workflowName?: string;
    workflowVersion?: number;
    environmentId?: string;
    environmentName?: string;
    status: 'PASSED' | 'FAILED';
    durationMs: number;
    errorSummary?: string;
    steps: Array<{
      nodeId: string;
      nodeLabel: string;
      nodeType: string;
      status: 'PASSED' | 'FAILED' | 'SKIPPED';
      durationMs: number;
      inputData?: any;
      outputData?: any;
      errorMessage?: string;
    }>;
    logs: Array<{ timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string; nodeId?: string }>;
  }): Promise<TestExecution> {
    const numericWfId = !isNaN(Number(params.workflowId)) ? Number(params.workflowId) : null;

    const stepLogs = params.steps.map((s, idx) => ({
      step: idx + 1,
      key: s.nodeId,
      sobject: s.nodeLabel,
      action: s.nodeType,
      status: s.status,
      durationMs: s.durationMs,
      error: s.errorMessage || null,
      input: s.inputData || {},
      output: s.outputData || {},
    }));

    // Create RUNNING log in DB
    const created = await TestLogApi.create({
      workflowId: numericWfId,
      triggerType: 'MANUAL',
      stepLogs,
    });

    // Complete log in DB
    const completed = await TestLogApi.complete(created.id, {
      status: params.status,
      durationMs: params.durationMs,
      errorMessage: params.errorSummary || null,
      stepLogs,
    });

    return mapLogToExecution(completed);
  }

  public static async triggerExecution(payload: { workflowId: string; environmentId?: string }): Promise<TestExecution> {
    const numericWfId = !isNaN(Number(payload.workflowId)) ? Number(payload.workflowId) : null;
    let wf: any;
    try {
      wf = await WorkflowApi.getWorkflowById(payload.workflowId);
    } catch {}

    const nodes = wf?.graph?.nodes || [];
    const stepLogs = nodes.map((n: any, idx: number) => ({
      step: idx + 1,
      key: n.id,
      sobject: n.data?.label || 'Action',
      action: n.data?.nodeType || 'ACTION',
      status: 'PASSED',
      durationMs: 300,
      input: n.data?.config || {},
      output: { simulated: true },
    }));

    const created = await TestLogApi.create({
      workflowId: numericWfId,
      triggerType: 'MANUAL',
      stepLogs,
    });

    const completed = await TestLogApi.complete(created.id, {
      status: 'PASSED',
      durationMs: Math.max(stepLogs.length * 300, 500),
      errorMessage: null,
      stepLogs,
    });

    return mapLogToExecution(completed, numericWfId ? { [numericWfId]: wf?.name } : {});
  }
}
