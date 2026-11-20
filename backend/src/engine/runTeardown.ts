// Deletes records created during workflow execution in reverse order of creation.
// Reports success or categorized failure reason for each deleted record.

import type { CreatedRecordTracker } from './createdRecords.js';
import type { SalesforcePort } from './salesforcePort.js';
import { ConnectionError, SalesforceError, ValidationError } from '../utils/errors.js';

export type TeardownReason =
  | 'noPermission'
  | 'validationOrTrigger'
  | 'writesBlocked'
  | 'recordLocked'
  | 'connectionProblem'
  | 'unknown';

export interface TeardownResult {
  sobjectName: string;
  recordId: string;
  status: 'deleted' | 'failed';
  reason?: TeardownReason;
  error?: string;
}

function classifyTeardownReason(error: unknown): TeardownReason {
  if (error instanceof ConnectionError) {
    return 'connectionProblem';
  }

  if (error instanceof ValidationError && error.code === 'WRITES_BLOCKED') {
    return 'writesBlocked';
  }

  if (error instanceof SalesforceError && error.errorCode) {
    if (error.errorCode === 'WRITES_BLOCKED') {
      return 'writesBlocked';
    }
    if (error.errorCode === 'INSUFFICIENT_ACCESS_OR_READONLY') {
      return 'noPermission';
    }
    if (error.errorCode === 'FIELD_CUSTOM_VALIDATION_EXCEPTION' || error.errorCode === 'CANNOT_EXECUTE_FLOW_TRIGGER') {
      return 'validationOrTrigger';
    }
    if (error.errorCode === 'ENTITY_IS_LOCKED') {
      return 'recordLocked';
    }
  }

  return 'unknown';
}

function sanitizeTeardownError(error: unknown): string {
  if (error instanceof Error) {
    const firstLine = error.message.split('\n')[0] ?? error.message;
    return firstLine.slice(0, 200).trim();
  }
  return 'Unknown teardown error';
}

export async function runTeardown(
  tracker: CreatedRecordTracker,
  port: SalesforcePort
): Promise<TeardownResult[]> {
  const records = [...tracker.getAll()].reverse();
  const results: TeardownResult[] = [];

  for (const record of records) {
    try {
      await port.deleteRecord(record.sobjectName, record.recordId);
      results.push({
        sobjectName: record.sobjectName,
        recordId: record.recordId,
        status: 'deleted'
      });
    } catch (error) {
      const reason = classifyTeardownReason(error);
      const cleanError = sanitizeTeardownError(error);
      results.push({
        sobjectName: record.sobjectName,
        recordId: record.recordId,
        status: 'failed',
        reason,
        error: cleanError
      });
    }
  }

  return results;
}
