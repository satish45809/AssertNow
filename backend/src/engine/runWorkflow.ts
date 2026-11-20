// Executes a validated workflow graph step-by-step using a SalesforcePort.
// Evaluates node handlers, records execution metrics, tracks created records, and enforces run time limits.

import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from './types.js';
import type { SalesforcePort } from './salesforcePort.js';
import type { RunResult, StepResult, FailureType } from './runTypes.js';
import { MAX_NODES_PER_WORKFLOW, MAX_RUN_TIME_MILLISECONDS } from './limits.js';
import { validateGraph } from './validateGraph.js';
import { resolveValue } from './resolveValues.js';
import { CreatedRecordTracker } from './createdRecords.js';
import { runTeardown, type TeardownResult } from './runTeardown.js';
import type { PollClock } from './pollUntil.js';
import { defaultClock } from './pollUntil.js';
import { executeCreateRecord } from './steps/createRecordStep.js';
import { executeGetRecord } from './steps/getRecordStep.js';
import { executeUpdateRecord } from './steps/updateRecordStep.js';
import { executeDeleteRecord } from './steps/deleteRecordStep.js';
import { executeDecision } from './steps/decisionStep.js';
import { executeAssert } from './steps/assertStep.js';
import {
  AssertionFailedError,
  SalesforceError,
  ConnectionError,
  SystemError
} from '../utils/errors.js';
import type {
  CreateRecordSettings,
  GetRecordSettings,
  UpdateRecordSettings,
  DeleteRecordSettings,
  DecisionSettings,
  AssertSettings
} from './nodeSettings.js';

export interface WorkflowRunOptions {
  clock?: PollClock;
  maxRunTimeMilliseconds?: number;
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const firstLine = error.message.split('\n')[0] ?? error.message;
    return firstLine.slice(0, 200).trim();
  }
  return 'Unknown execution error';
}

function classifyError(error: unknown): { failureType: FailureType; isFailure: boolean } {
  if (error instanceof AssertionFailedError) {
    return { failureType: 'assertionFailed', isFailure: true };
  }
  if (error instanceof SalesforceError) {
    return { failureType: 'salesforceError', isFailure: true };
  }
  if (error instanceof ConnectionError) {
    return { failureType: 'connectionError', isFailure: false };
  }
  return { failureType: 'systemError', isFailure: false };
}

function checkTimeLimit(
  startTime: number,
  now: number,
  maxTime: number
): boolean {
  return now - startTime >= maxTime;
}

async function runStepHandler(
  node: WorkflowNode,
  resolvedSettings: unknown,
  port: SalesforcePort,
  tracker: CreatedRecordTracker,
  clock: PollClock,
  remainingTimeMs: number
): Promise<unknown> {
  if (node.type === 'start') {
    return {};
  }
  if (node.type === 'createRecord') {
    const result = await executeCreateRecord(resolvedSettings as CreateRecordSettings, port);
    tracker.add((resolvedSettings as CreateRecordSettings).sobjectName, result.Id);
    return result;
  }
  if (node.type === 'getRecord') {
    return executeGetRecord(resolvedSettings as GetRecordSettings, port, clock, remainingTimeMs);
  }
  if (node.type === 'updateRecord') {
    return executeUpdateRecord(resolvedSettings as UpdateRecordSettings, port);
  }
  if (node.type === 'deleteRecord') {
    return executeDeleteRecord(resolvedSettings as DeleteRecordSettings, port);
  }
  if (node.type === 'decision') {
    return executeDecision(resolvedSettings as DecisionSettings);
  }
  if (node.type === 'assert') {
    return executeAssert(resolvedSettings as AssertSettings);
  }
  throw new SystemError(`Unsupported node type '${node.type}'`);
}

function findNextNode(
  nodeId: string,
  kind: 'next' | 'true' | 'false' | 'fault',
  edges: WorkflowEdge[]
): string | null {
  for (const edge of edges) {
    if (edge.source === nodeId && edge.kind === kind) {
      return edge.target;
    }
  }
  return null;
}

export async function runWorkflow(
  graph: WorkflowGraph,
  port: SalesforcePort,
  options?: WorkflowRunOptions
): Promise<RunResult> {
  const validationProblems = validateGraph(graph);
  if (validationProblems.length > 0) {
    return {
      status: 'error',
      steps: [],
      validationProblems,
      teardown: [],
      cleanupFailed: false
    };
  }

  const clock = options?.clock ?? defaultClock;
  const maxRunTime = options?.maxRunTimeMilliseconds ?? MAX_RUN_TIME_MILLISECONDS;
  const workflowStartTime = clock.now();

  const tracker = new CreatedRecordTracker();
  const nodeMap = new Map<string, WorkflowNode>();
  let startNodeId = '';
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
    if (node.type === 'start') startNodeId = node.id;
  }

  const steps: StepResult[] = [];
  const outputsByNode = new Map<string, unknown>();
  let currentNodeId: string | null = startNodeId;
  let hasFailure = false;
  let hasError = false;
  let executedStepCount = 0;

  try {
    while (currentNodeId) {
      const node = nodeMap.get(currentNodeId)!;
      const startedAt = new Date(clock.now()).toISOString();
      const stepStartTime = clock.now();

      // Check max run time before executing the next node
      if (checkTimeLimit(workflowStartTime, clock.now(), maxRunTime)) {
        hasError = true;
        steps.push({
          nodeId: node.id,
          nodeType: node.type,
          status: 'error',
          input: null,
          output: null,
          error: 'Run time limit reached',
          failureType: 'systemError',
          startedAt,
          durationMilliseconds: 0
        });
        break;
      }

      if (executedStepCount >= MAX_NODES_PER_WORKFLOW) {
        hasError = true;
        steps.push({
          nodeId: node.id,
          nodeType: node.type,
          status: 'error',
          input: null,
          output: null,
          error: `Execution step count exceeded maximum limit of ${MAX_NODES_PER_WORKFLOW}`,
          failureType: 'systemError',
          startedAt,
          durationMilliseconds: 0
        });
        break;
      }

      executedStepCount++;

      let resolvedSettings: unknown;
      try {
        resolvedSettings = resolveValue(node.settings, outputsByNode);
      } catch (resolutionError) {
        hasError = true;
        const durationMilliseconds = clock.now() - stepStartTime;
        const message = sanitizeErrorMessage(resolutionError);
        steps.push({
          nodeId: node.id,
          nodeType: node.type,
          status: 'error',
          input: node.settings,
          output: null,
          error: message,
          failureType: 'systemError',
          startedAt,
          durationMilliseconds
        });
        const faultTarget = findNextNode(node.id, 'fault', graph.edges);
        currentNodeId = faultTarget;
        continue;
      }

      try {
        const remainingTime = maxRunTime - (clock.now() - workflowStartTime);
        const output = await runStepHandler(node, resolvedSettings, port, tracker, clock, remainingTime);
        const durationMilliseconds = clock.now() - stepStartTime;
        outputsByNode.set(node.id, output);

        steps.push({
          nodeId: node.id,
          nodeType: node.type,
          status: 'passed',
          input: resolvedSettings,
          output,
          startedAt,
          durationMilliseconds
        });

        if (node.type === 'decision') {
          const decisionResult = output as { branch: 'true' | 'false' };
          currentNodeId = findNextNode(node.id, decisionResult.branch, graph.edges);
        } else {
          currentNodeId = findNextNode(node.id, 'next', graph.edges);
        }
      } catch (executionError) {
        const durationMilliseconds = clock.now() - stepStartTime;
        const { failureType, isFailure } = classifyError(executionError);
        if (isFailure) hasFailure = true;
        else hasError = true;

        const message = sanitizeErrorMessage(executionError);
        steps.push({
          nodeId: node.id,
          nodeType: node.type,
          status: isFailure ? 'failed' : 'error',
          input: resolvedSettings,
          output: null,
          error: message,
          failureType,
          startedAt,
          durationMilliseconds
        });

        const faultTarget = findNextNode(node.id, 'fault', graph.edges);
        currentNodeId = faultTarget;
      }
    }
  } finally {
    // Teardown always runs after the main steps, even if interrupted or timed out
  }

  let teardownResults: TeardownResult[] = [];
  let cleanupFailed = false;

  try {
    teardownResults = await runTeardown(tracker, port);
    cleanupFailed = teardownResults.some((t) => t.status === 'failed');
  } catch (teardownError) {
    cleanupFailed = true;
    teardownResults.push({
      sobjectName: 'Unknown',
      recordId: 'Unknown',
      status: 'failed',
      reason: 'unknown',
      error: sanitizeErrorMessage(teardownError)
    });
  }

  // Precedence: "error" beats "failed".
  // If any system or connection error occurred, the run status is "error";
  // otherwise, if an assertion or Salesforce failure occurred, it is "failed".
  // Note: Test status and cleanup result are two distinct facts: even if the test passed,
  // any leftover uncleaned record is never hidden, and cleanupFailed is set to true.
  let finalStatus: RunResult['status'] = 'passed';
  if (hasError) {
    finalStatus = 'error';
  } else if (hasFailure) {
    finalStatus = 'failed';
  }

  return {
    status: finalStatus,
    steps,
    teardown: teardownResults,
    cleanupFailed
  };
}
