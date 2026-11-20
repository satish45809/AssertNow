// Tests the teardown of created records in reverse order and categorization of teardown failures.
// Verifies error classifications (noPermission, validationOrTrigger, writesBlocked, recordLocked, connectionProblem, unknown).

import { describe, it, expect, vi } from 'vitest';
import { CreatedRecordTracker } from './createdRecords.js';
import { runTeardown } from './runTeardown.js';
import type { SalesforcePort } from './salesforcePort.js';
import { ConnectionError, SalesforceError, ValidationError } from '../utils/errors.js';

describe('runTeardown', () => {
  it('deletes tracked records in reverse order of creation', async () => {
    const tracker = new CreatedRecordTracker();
    tracker.add('Account', '001xx000001');
    tracker.add('Contact', '003xx000002');
    tracker.add('Opportunity', '006xx000003');

    const deletedOrder: string[] = [];
    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn().mockImplementation(async (_sobject: string, recordId: string) => {
        deletedOrder.push(recordId);
      })
    };

    const results = await runTeardown(tracker, port);
    expect(deletedOrder).toEqual(['006xx000003', '003xx000002', '001xx000001']);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'deleted')).toBe(true);
  });

  it('continues deleting remaining records when one delete fails', async () => {
    const tracker = new CreatedRecordTracker();
    tracker.add('Account', '001xx000001');
    tracker.add('Contact', '003xx000002');

    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn().mockImplementation(async (_sobject: string, recordId: string) => {
        if (recordId === '003xx000002') {
          throw new SalesforceError('Failed', 'UNKNOWN_ERROR');
        }
      })
    };

    const results = await runTeardown(tracker, port);
    expect(results).toHaveLength(2);
    expect(results[0]!.recordId).toBe('003xx000002');
    expect(results[0]!.status).toBe('failed');
    expect(results[1]!.recordId).toBe('001xx000001');
    expect(results[1]!.status).toBe('deleted');
  });

  it('classifies reason as noPermission for INSUFFICIENT_ACCESS_OR_READONLY', async () => {
    const tracker = new CreatedRecordTracker();
    tracker.add('Account', '001xx000001');

    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn().mockRejectedValue(new SalesforceError('Access denied', 'INSUFFICIENT_ACCESS_OR_READONLY'))
    };

    const results = await runTeardown(tracker, port);
    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.reason).toBe('noPermission');
  });

  it('classifies reason as validationOrTrigger for FIELD_CUSTOM_VALIDATION_EXCEPTION', async () => {
    const tracker = new CreatedRecordTracker();
    tracker.add('Account', '001xx000001');

    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn().mockRejectedValue(new SalesforceError('Trigger failed', 'FIELD_CUSTOM_VALIDATION_EXCEPTION'))
    };

    const results = await runTeardown(tracker, port);
    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.reason).toBe('validationOrTrigger');
  });

  it('classifies reason as writesBlocked for WRITES_BLOCKED validation error', async () => {
    const tracker = new CreatedRecordTracker();
    tracker.add('Account', '001xx000001');

    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn().mockRejectedValue(new ValidationError('Writes blocked', 'WRITES_BLOCKED'))
    };

    const results = await runTeardown(tracker, port);
    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.reason).toBe('writesBlocked');
  });

  it('classifies reason as recordLocked for ENTITY_IS_LOCKED', async () => {
    const tracker = new CreatedRecordTracker();
    tracker.add('Account', '001xx000001');

    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn().mockRejectedValue(new SalesforceError('Locked', 'ENTITY_IS_LOCKED'))
    };

    const results = await runTeardown(tracker, port);
    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.reason).toBe('recordLocked');
  });

  it('classifies reason as connectionProblem for ConnectionError', async () => {
    const tracker = new CreatedRecordTracker();
    tracker.add('Account', '001xx000001');

    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn().mockRejectedValue(new ConnectionError('Org offline'))
    };

    const results = await runTeardown(tracker, port);
    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.reason).toBe('connectionProblem');
  });

  it('classifies reason as unknown for unmapped errors', async () => {
    const tracker = new CreatedRecordTracker();
    tracker.add('Account', '001xx000001');

    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn().mockRejectedValue(new Error('Something unexpected'))
    };

    const results = await runTeardown(tracker, port);
    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.reason).toBe('unknown');
  });

  it('returns empty results when tracker has no created records', async () => {
    const tracker = new CreatedRecordTracker();
    const port: SalesforcePort = {
      createRecord: vi.fn(),
      getRecord: vi.fn(),
      updateRecord: vi.fn(),
      deleteRecord: vi.fn()
    };

    const results = await runTeardown(tracker, port);
    expect(results).toEqual([]);
    expect(port.deleteRecord).not.toHaveBeenCalled();
  });
});
