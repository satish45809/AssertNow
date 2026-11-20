// Handles the execution of a getRecord node with optional polling support.
// Evaluates waitUntil conditions by querying fresh data from SalesforcePort until matched or timed out.

import type { SalesforcePort } from '../salesforcePort.js';
import type { GetRecordSettings } from '../nodeSettings.js';
import type { PollClock } from '../pollUntil.js';
import { pollUntil } from '../pollUntil.js';
import {
  DEFAULT_POLL_TIMEOUT_MILLISECONDS,
  DEFAULT_POLL_INTERVAL_MILLISECONDS
} from '../limits.js';
import { AssertionFailedError, ConnectionError, ValidationError, SalesforceError } from '../../utils/errors.js';

function checkWaitUntilCondition(
  record: Record<string, unknown>,
  condition: NonNullable<GetRecordSettings['waitUntil']>
): boolean {
  const actualValue = record[condition.field];
  if (condition.operator === 'equals') {
    return String(actualValue) === String(condition.value);
  }
  if (condition.operator === 'notEquals') {
    return String(actualValue) !== String(condition.value);
  }
  if (condition.operator === 'contains') {
    return String(actualValue).includes(String(condition.value));
  }
  return false;
}

export async function executeGetRecord(
  settings: GetRecordSettings,
  port: SalesforcePort,
  clock?: PollClock,
  remainingWorkflowTimeMs?: number
): Promise<Record<string, unknown>> {
  if (!settings.waitUntil && !settings.waitForMilliseconds) {
    return port.getRecord(settings.sobjectName, settings.recordId, settings.fields);
  }

  const requestedTimeout = settings.waitForMilliseconds ?? DEFAULT_POLL_TIMEOUT_MILLISECONDS;
  const timeoutMilliseconds = remainingWorkflowTimeMs !== undefined
    ? Math.min(requestedTimeout, Math.max(0, remainingWorkflowTimeMs))
    : requestedTimeout;
  const intervalMilliseconds = settings.pollIntervalMilliseconds ?? DEFAULT_POLL_INTERVAL_MILLISECONDS;

  let lastRecord: Record<string, unknown> = {};
  let lastSalesforceError: SalesforceError | null = null;

  const pollResult = await pollUntil(async () => {
    try {
      lastRecord = await port.getRecord(settings.sobjectName, settings.recordId, settings.fields);
      lastSalesforceError = null;
    } catch (error) {
      if (error instanceof ConnectionError || (error instanceof ValidationError && error.code === 'WRITES_BLOCKED')) {
        throw error;
      }
      if (error instanceof SalesforceError) {
        lastSalesforceError = error;
      }
      return { passed: false, value: lastRecord };
    }

    if (settings.waitUntil) {
      const conditionPassed = checkWaitUntilCondition(lastRecord, settings.waitUntil);
      return { passed: conditionPassed, value: lastRecord };
    }

    return { passed: true, value: lastRecord };
  }, {
    timeoutMilliseconds,
    intervalMilliseconds,
    clock
  });

  if (!pollResult.passed) {
    const errorToThrow = lastSalesforceError as SalesforceError | null;
    if (errorToThrow) {
      const cleanFirstLine = errorToThrow.message.split('\n')[0] ?? errorToThrow.message;
      const combinedMessage = `${cleanFirstLine} (failed after ${pollResult.attempts} tries)`.slice(0, 200).trim();
      throw new SalesforceError(combinedMessage, errorToThrow.errorCode);
    }

    if (settings.waitUntil) {
      const actual = lastRecord[settings.waitUntil.field];
      const message = `Timed out waiting for ${settings.sobjectName}.${settings.waitUntil.field} to ${settings.waitUntil.operator} '${settings.waitUntil.value}' after ${pollResult.attempts} tries (last value: '${actual}')`;
      throw new AssertionFailedError(message);
    }
  }

  return pollResult.value;
}
