// Defines the execution status and result structures for a workflow run and its individual steps.
// Encapsulates step-level inputs, outputs, execution timing, and standardized failure categories.

import type { NodeType, ValidationProblem } from './types.js';
import type { TeardownResult } from './runTeardown.js';

// "failed" means the test found a real problem (e.g. assertion failed, Salesforce business error).
// "error" means the test could not run properly (e.g. connection error, system crash).
export type RunStatus = 'passed' | 'failed' | 'error';

export type StepStatus = 'passed' | 'failed' | 'error';

export type FailureType =
  | 'assertionFailed'
  | 'salesforceError'
  | 'connectionError'
  | 'systemError';

export interface StepResult {
  nodeId: string;
  nodeType: NodeType;
  status: StepStatus;
  input: unknown;
  output: unknown;
  error?: string;
  failureType?: FailureType;
  startedAt: string;
  durationMilliseconds: number;
}

export interface RunResult {
  status: RunStatus;
  steps: StepResult[];
  validationProblems?: ValidationProblem[];
  teardown: TeardownResult[];
  cleanupFailed: boolean;
}
