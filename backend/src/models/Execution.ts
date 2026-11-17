/**
 * Test Execution & Assertion Trace Contracts
 */

export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';

export type StepStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';

export interface ExecutionStepResult {
  stepId: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  status: StepStatus;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  assertionVerdict?: {
    passed: boolean;
    rule: string;
    actualValue?: unknown;
    expectedValue?: unknown;
    errorMessage?: string;
  };
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  environmentId: string;
  environmentName: string;
  status: ExecutionStatus;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  triggeredBy: string; // User ID or 'AUTOMATED_SCHEDULE'
  steps: ExecutionStepResult[];
  errorMessage?: string;
}

export interface TriggerExecutionDto {
  workflowId: string;
  environmentId?: string;
  variables?: Record<string, unknown>;
}

