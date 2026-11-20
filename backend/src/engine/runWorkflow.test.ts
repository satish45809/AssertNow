// Tests workflow execution with an in-memory fake SalesforcePort.
// Verifies sequential execution, branch routing, fault handling, failure classification, and limits.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowGraph } from './types.js';
import type { SalesforcePort } from './salesforcePort.js';
import { runWorkflow } from './runWorkflow.js';
import { resolveValue } from './resolveValues.js';
import type { PollClock } from './pollUntil.js';
import * as validateGraphModule from './validateGraph.js';
import { SalesforceError, ConnectionError, SystemError } from '../utils/errors.js';

describe('resolveValues Helper', () => {
  it('preserves real type when a value is strictly an exact reference', () => {
    const outputs = new Map<string, unknown>();
    outputs.set('create1', { Id: '001xx000003DHP0AAO', Amount: 50000, IsActive: true });

    const numberValue = resolveValue('{{create1.Amount}}', outputs);
    expect(typeof numberValue).toBe('number');
    expect(numberValue).toBe(50000);

    const booleanValue = resolveValue('{{create1.IsActive}}', outputs);
    expect(typeof booleanValue).toBe('boolean');
    expect(booleanValue).toBe(true);
  });

  it('converts reference inside surrounding text into a string', () => {
    const outputs = new Map<string, unknown>();
    outputs.set('create1', { Id: '001xx000003DHP0AAO', Name: 'Acme Corp' });

    const embedded = resolveValue('Created account: {{create1.Name}} (Id: {{create1.Id}})', outputs);
    expect(embedded).toBe('Created account: Acme Corp (Id: 001xx000003DHP0AAO)');
  });

  it('throws a plain error if referenced step has no output at runtime', () => {
    const outputs = new Map<string, unknown>();
    expect(() => resolveValue('{{missingStep.Id}}', outputs)).toThrow(SystemError);
    expect(() => resolveValue('{{missingStep.Id}}', outputs)).toThrow(
      "Reference '{{missingStep.Id}}' could not be resolved: node 'missingStep' has no output"
    );
  });
});

describe('Workflow Runner', () => {
  let fakePort: SalesforcePort;

  beforeEach(() => {
    vi.restoreAllMocks();
    fakePort = {
      createRecord: vi.fn().mockResolvedValue({ Id: '001xx000003DHP0AAO' }),
      getRecord: vi.fn().mockResolvedValue({ Id: '001xx000003DHP0AAO', Name: 'Acme Corp', AnnualRevenue: 50000 }),
      updateRecord: vi.fn().mockResolvedValue(undefined),
      deleteRecord: vi.fn().mockResolvedValue(undefined)
    };
  });

  function createSimulatedClock(initialTime = 1000): { clock: PollClock; advanceTime: (ms: number) => void } {
    let currentTime = initialTime;
    const clock: PollClock = {
      now: () => currentTime,
      sleep: async (ms: number) => {
        currentTime += ms;
      }
    };
    return {
      clock,
      advanceTime: (ms: number) => {
        currentTime += ms;
      }
    };
  }

  it('executes a complete successful run through start -> create -> get -> assert and runs teardown', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'create1',
          type: 'createRecord',
          settings: {
            sobjectName: 'Account',
            fields: { Name: 'Acme Corp' }
          }
        },
        {
          id: 'get1',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '{{create1.Id}}',
            fields: ['Id', 'Name']
          }
        },
        {
          id: 'assert1',
          type: 'assert',
          settings: {
            leftOperand: '{{get1.Name}}',
            operator: 'equals',
            rightOperand: 'Acme Corp'
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'create1', kind: 'next' },
        { id: 'e2', source: 'create1', target: 'get1', kind: 'next' },
        { id: 'e3', source: 'get1', target: 'assert1', kind: 'next' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(result.steps).toHaveLength(4);
    expect(result.steps.every((s) => s.status === 'passed')).toBe(true);

    expect(result.cleanupFailed).toBe(false);
    expect(result.teardown).toHaveLength(1);
    expect(result.teardown[0]!.sobjectName).toBe('Account');
    expect(result.teardown[0]!.recordId).toBe('001xx000003DHP0AAO');
    expect(result.teardown[0]!.status).toBe('deleted');
    expect(fakePort.deleteRecord).toHaveBeenCalledWith('Account', '001xx000003DHP0AAO');
  });

  it('polls getRecord with waitUntil condition and passes on later try', async () => {
    let callCount = 0;
    vi.spyOn(fakePort, 'getRecord').mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return { Id: '001xx000003DHP0AAO', Status: 'Processing' };
      }
      return { Id: '001xx000003DHP0AAO', Status: 'Completed' };
    });

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'getPoll',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            waitUntil: { field: 'Status', operator: 'equals', value: 'Completed' },
            waitForMilliseconds: 5000,
            pollIntervalMilliseconds: 1000
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'getPoll', kind: 'next' }]
    };

    const { clock } = createSimulatedClock();
    const result = await runWorkflow(graph, fakePort, { clock });
    expect(result.status).toBe('passed');
    expect(callCount).toBe(3);
  });

  it('times out in getRecord waitUntil and reports tries and last actual value as assertionFailed', async () => {
    vi.spyOn(fakePort, 'getRecord').mockResolvedValue({ Id: '001xx000003DHP0AAO', Status: 'Stuck' });

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'getTimeout',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            waitUntil: { field: 'Status', operator: 'equals', value: 'Completed' },
            waitForMilliseconds: 2000,
            pollIntervalMilliseconds: 1000
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'getTimeout', kind: 'next' }]
    };

    const { clock } = createSimulatedClock();
    const result = await runWorkflow(graph, fakePort, { clock });
    expect(result.status).toBe('failed');
    const step = result.steps[1]!;
    expect(step.failureType).toBe('assertionFailed');
    expect(step.error).toContain("Timed out waiting for Account.Status to equals 'Completed'");
    expect(step.error).toContain("last value: 'Stuck'");
  });

  it('stops immediately if ConnectionError occurs during getRecord poll', async () => {
    let callCount = 0;
    vi.spyOn(fakePort, 'getRecord').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { Id: '001xx000003DHP0AAO', Status: 'Initial' };
      }
      throw new ConnectionError('Connection dropped');
    });

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'getConnFail',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            waitUntil: { field: 'Status', operator: 'equals', value: 'Done' },
            waitForMilliseconds: 5000,
            pollIntervalMilliseconds: 1000
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'getConnFail', kind: 'next' }]
    };

    const { clock } = createSimulatedClock();
    const result = await runWorkflow(graph, fakePort, { clock });
    expect(result.status).toBe('error');
    expect(result.steps[1]!.failureType).toBe('connectionError');
    // Aborted on the connection error without burning through the rest of the 5s timeout
    expect(callCount).toBe(2);
  });

  it('stops starting new steps when MAX_RUN_TIME_MILLISECONDS is reached', async () => {
    const { clock, advanceTime } = createSimulatedClock();

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'step1',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Acme' } }
        },
        {
          id: 'step2',
          type: 'getRecord',
          settings: { sobjectName: 'Account', recordId: '{{step1.Id}}' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'step1', kind: 'next' },
        { id: 'e2', source: 'step1', target: 'step2', kind: 'next' }
      ]
    };

    // Spy createRecord to simulate that step1 took long enough to breach the limit
    vi.spyOn(fakePort, 'createRecord').mockImplementation(async () => {
      advanceTime(300001); // Exceeds 300,000 ms
      return { Id: '001xx000003DHP0AAO' };
    });

    const result = await runWorkflow(graph, fakePort, { clock });
    expect(result.status).toBe('error');
    // Step 2 is recorded with error "Run time limit reached"
    const limitStep = result.steps[2]!;
    expect(limitStep.nodeId).toBe('step2');
    expect(limitStep.nodeType).toBe('getRecord');
    expect(limitStep.error).toBe('Run time limit reached');
    expect(limitStep.failureType).toBe('systemError');

    // Teardown STILL ran and cleaned up the record created by step1
    expect(result.teardown).toHaveLength(1);
    expect(result.teardown[0]!.recordId).toBe('001xx000003DHP0AAO');
    expect(result.teardown[0]!.status).toBe('deleted');
  });

  it('cuts getRecord polling short when remaining workflow run time expires', async () => {
    let currentTime = 1000;
    const sleeps: number[] = [];
    const clock: PollClock = {
      now: () => currentTime,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        currentTime += ms;
      }
    };

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'stepWaitBefore',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Test' } }
        },
        {
          id: 'stepLongPoll',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            waitUntil: { field: 'Status', operator: 'equals', value: 'Ready' },
            waitForMilliseconds: 60000, // Wants 60s
            pollIntervalMilliseconds: 1000
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'stepWaitBefore', kind: 'next' },
        { id: 'e2', source: 'stepWaitBefore', target: 'stepLongPoll', kind: 'next' }
      ]
    };

    // Simulate stepWaitBefore taking 8000ms so only 2000ms remain out of 10000ms budget
    vi.spyOn(fakePort, 'createRecord').mockImplementationOnce(async () => {
      currentTime += 8000;
      return { Id: '001xx000003DHP0AAO' };
    });

    const startPollTime = currentTime + 8000;
    const result = await runWorkflow(graph, fakePort, { clock, maxRunTimeMilliseconds: 10000 });
    expect(result.status).toBe('failed');
    // Polling terminated after 2s (two 1000ms sleeps) because remaining workflow budget was 2000ms
    expect(clock.now() - startPollTime).toBe(2000);
    expect(sleeps).toEqual([1000, 1000]);
  });

  it('shows last real error and number of tries when getRecord polling continuously throws SalesforceError until timeout', async () => {
    vi.spyOn(fakePort, 'getRecord').mockRejectedValue(
      new SalesforceError('RECORD_LOCKED: Row in use', 'ENTITY_IS_LOCKED')
    );

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'getPollingError',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            waitUntil: { field: 'Status', operator: 'equals', value: 'Ready' },
            waitForMilliseconds: 2000,
            pollIntervalMilliseconds: 1000
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'getPollingError', kind: 'next' }]
    };

    const { clock } = createSimulatedClock();
    const result = await runWorkflow(graph, fakePort, { clock });
    expect(result.status).toBe('failed');
    const step = result.steps[1]!;
    expect(step.failureType).toBe('salesforceError');
    // StepResult does not carry an errorCode field, so we verify through the error message and failureType
    expect(step.error).toContain('RECORD_LOCKED: Row in use');
    expect(step.error).toContain('failed after 2 tries');
  });

  it('executes teardown and deletes all created records after run time limit is reached', async () => {
    const { clock, advanceTime } = createSimulatedClock();

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'step1',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Acme' } }
        },
        {
          id: 'step2',
          type: 'getRecord',
          settings: { sobjectName: 'Account', recordId: '{{step1.Id}}' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'step1', kind: 'next' },
        { id: 'e2', source: 'step1', target: 'step2', kind: 'next' }
      ]
    };

    vi.spyOn(fakePort, 'createRecord').mockImplementation(async () => {
      advanceTime(300001); // Exceeds 300,000 ms
      return { Id: '001xx000003DHP0AAO' };
    });

    const result = await runWorkflow(graph, fakePort, { clock });
    expect(result.status).toBe('error');
    expect(result.steps[2]!.error).toBe('Run time limit reached');
    expect(result.teardown).toHaveLength(1);
    expect(result.teardown[0]!.recordId).toBe('001xx000003DHP0AAO');
    expect(result.teardown[0]!.status).toBe('deleted');
    expect(fakePort.deleteRecord).toHaveBeenCalledWith('Account', '001xx000003DHP0AAO');
  });

  it('runs teardown after a failed assertion', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'create1',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Test' } }
        },
        {
          id: 'assertFail',
          type: 'assert',
          settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'B' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'create1', kind: 'next' },
        { id: 'e2', source: 'create1', target: 'assertFail', kind: 'next' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('failed');
    expect(result.teardown).toHaveLength(1);
    expect(result.teardown[0]!.status).toBe('deleted');
    expect(fakePort.deleteRecord).toHaveBeenCalledWith('Account', '001xx000003DHP0AAO');
  });

  it('runs teardown and deletes created record when a later step crashes', async () => {
    vi.spyOn(fakePort, 'getRecord').mockRejectedValue(new TypeError('Crash in getRecord'));

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'create1',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Test' } }
        },
        {
          id: 'crashNode',
          type: 'getRecord',
          settings: { sobjectName: 'Account', recordId: '{{create1.Id}}' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'create1', kind: 'next' },
        { id: 'e2', source: 'create1', target: 'crashNode', kind: 'next' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('error');
    expect(result.teardown).toHaveLength(1);
    expect(result.teardown[0]!.status).toBe('deleted');
    expect(fakePort.deleteRecord).toHaveBeenCalledWith('Account', '001xx000003DHP0AAO');
  });

  it('keeps status passed and sets cleanupFailed true when steps pass but teardown fails', async () => {
    vi.spyOn(fakePort, 'deleteRecord').mockRejectedValue(
      new SalesforceError('Cannot delete', 'INSUFFICIENT_ACCESS_OR_READONLY')
    );

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'create1',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Test' } }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'create1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(result.cleanupFailed).toBe(true);
    expect(result.teardown[0]!.status).toBe('failed');
    expect(result.teardown[0]!.reason).toBe('noPermission');
  });

  it('never deletes records that getRecord or fixed record IDs referenced', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'getExisting',
          type: 'getRecord',
          settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'getExisting', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(result.teardown).toHaveLength(0);
    expect(fakePort.deleteRecord).not.toHaveBeenCalled();
  });

  it('returns empty teardown when a workflow created no records', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'assert1', type: 'assert', settings: { leftOperand: '1', operator: 'equals', rightOperand: '1' } }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'assert1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.teardown).toEqual([]);
    expect(result.cleanupFailed).toBe(false);
  });

  it('still returns main result and reports failure if runTeardown throws an unexpected exception', async () => {
    vi.spyOn(fakePort, 'deleteRecord').mockImplementation(() => {
      throw new Error('Fatal filesystem crash during teardown');
    });

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'create1',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Test' } }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'create1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(result.cleanupFailed).toBe(true);
    expect(result.teardown[0]!.status).toBe('failed');
    expect(result.teardown[0]!.error).toContain('Fatal filesystem crash');
  });

  it('follows the true branch on a matching decision', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'decide1',
          type: 'decision',
          settings: { leftOperand: '100', operator: 'equals', rightOperand: '100' }
        },
        {
          id: 'trueNode',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'True' } }
        },
        {
          id: 'falseNode',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'False' } }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'decide1', kind: 'next' },
        { id: 'e2', source: 'decide1', target: 'trueNode', kind: 'true' },
        { id: 'e3', source: 'decide1', target: 'falseNode', kind: 'false' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(result.steps.map((s) => s.nodeId)).toEqual(['start1', 'decide1', 'trueNode']);
  });

  it('follows the false branch on a non-matching decision', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'decide1',
          type: 'decision',
          settings: { leftOperand: '100', operator: 'equals', rightOperand: '200' }
        },
        {
          id: 'trueNode',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'True' } }
        },
        {
          id: 'falseNode',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'False' } }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'decide1', kind: 'next' },
        { id: 'e2', source: 'decide1', target: 'trueNode', kind: 'true' },
        { id: 'e3', source: 'decide1', target: 'falseNode', kind: 'false' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(result.steps.map((s) => s.nodeId)).toEqual(['start1', 'decide1', 'falseNode']);
  });

  it('follows the fault path when a node fails, but leaves run status as failed', async () => {
    vi.spyOn(fakePort, 'createRecord')
      .mockRejectedValueOnce(new SalesforceError('DUPLICATE_VALUE: record already exists'))
      .mockResolvedValueOnce({ Id: '003xx000003DHP0AAO' });

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'failingCreate',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Dup' } }
        },
        {
          id: 'faultRecovery',
          type: 'createRecord',
          settings: { sobjectName: 'Contact', fields: { LastName: 'Recovered' } }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'failingCreate', kind: 'next' },
        { id: 'e2', source: 'failingCreate', target: 'faultRecovery', kind: 'fault' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('failed');
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1]!.status).toBe('failed');
    expect(result.steps[1]!.failureType).toBe('salesforceError');
    expect(result.steps[2]!.status).toBe('passed');
  });

  it('stops execution immediately when a failing node has no fault edge', async () => {
    vi.spyOn(fakePort, 'createRecord').mockRejectedValue(new SalesforceError('FIELD_CUSTOM_VALIDATION_EXCEPTION'));

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'failingCreate',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Dup' } }
        },
        {
          id: 'unreachedNext',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Unreached' } }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'failingCreate', kind: 'next' },
        { id: 'e2', source: 'failingCreate', target: 'unreachedNext', kind: 'next' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('failed');
    expect(result.steps).toHaveLength(2);
    expect(result.steps.map((s) => s.nodeId)).toEqual(['start1', 'failingCreate']);
  });

  it('refuses to run a bad graph and makes zero port calls', async () => {
    const invalidGraph: WorkflowGraph = {
      nodes: [
        { id: 'nodeA', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } }
      ],
      edges: []
    };

    const result = await runWorkflow(invalidGraph, fakePort);
    expect(result.status).toBe('error');
    expect(result.steps).toHaveLength(0);
    expect(result.validationProblems).toBeTruthy();
    expect(result.validationProblems!.length).toBeGreaterThan(0);

    expect(fakePort.createRecord).toHaveBeenCalledTimes(0);
    expect(fakePort.getRecord).toHaveBeenCalledTimes(0);
    expect(fakePort.updateRecord).toHaveBeenCalledTimes(0);
    expect(fakePort.deleteRecord).toHaveBeenCalledTimes(0);
  });

  it('fails with assertionFailed when an assert condition is not met', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'assert1',
          type: 'assert',
          settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'B', message: 'Values differ' }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'assert1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('failed');
    const assertStep = result.steps[1]!;
    expect(assertStep.status).toBe('failed');
    expect(assertStep.failureType).toBe('assertionFailed');
    expect(assertStep.error).toBe('Values differ');
  });

  it('fails with salesforceError when port throws SalesforceError', async () => {
    vi.spyOn(fakePort, 'createRecord').mockRejectedValue(new SalesforceError('REQUIRED_FIELD_MISSING: Missing Name'));

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'create1', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'create1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('failed');
    expect(result.steps[1]!.failureType).toBe('salesforceError');
  });

  it('fails with connectionError when port throws ConnectionError', async () => {
    vi.spyOn(fakePort, 'createRecord').mockRejectedValue(new ConnectionError('Org unreachable'));

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'create1', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'create1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('error');
    expect(result.steps[1]!.failureType).toBe('connectionError');
  });

  it('fails with systemError when an unexpected crash occurs', async () => {
    vi.spyOn(fakePort, 'createRecord').mockRejectedValue(new TypeError('Cannot read property of undefined'));

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'create1', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'create1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('error');
    expect(result.steps[1]!.failureType).toBe('systemError');
  });

  it('executes updateRecord step successfully', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'update1',
          type: 'updateRecord',
          settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO', fields: { Name: 'New Name' } }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'update1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(fakePort.updateRecord).toHaveBeenCalledWith('Account', '001xx000003DHP0AAO', { Name: 'New Name' });
  });

  it('executes deleteRecord step successfully', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'delete1',
          type: 'deleteRecord',
          settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'delete1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(fakePort.deleteRecord).toHaveBeenCalledWith('Account', '001xx000003DHP0AAO');
  });

  it('executes assert passing with notEquals and contains operators', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'assertNotEquals',
          type: 'assert',
          settings: { leftOperand: 'Active', operator: 'notEquals', rightOperand: 'Inactive' }
        },
        {
          id: 'assertContains',
          type: 'assert',
          settings: { leftOperand: 'Acme Corporation', operator: 'contains', rightOperand: 'Corp' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'assertNotEquals', kind: 'next' },
        { id: 'e2', source: 'assertNotEquals', target: 'assertContains', kind: 'next' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(result.steps).toHaveLength(3);
    expect(result.steps.every((s) => s.status === 'passed')).toBe(true);
  });

  it('executes getRecord with specific fields passed to port', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'getWithFields',
          type: 'getRecord',
          settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO', fields: ['Id', 'Name', 'Account.Name'] }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'getWithFields', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('passed');
    expect(fakePort.getRecord).toHaveBeenCalledWith('Account', '001xx000003DHP0AAO', ['Id', 'Name', 'Account.Name']);
  });

  it('prefers error over failed when both occur in one run', async () => {
    vi.spyOn(fakePort, 'createRecord').mockRejectedValueOnce(new SalesforceError('DUPLICATE_VALUE'));
    vi.spyOn(fakePort, 'getRecord').mockRejectedValueOnce(new ConnectionError('Org unreachable'));

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'step1Fails',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Dup' } }
        },
        {
          id: 'step2Errors',
          type: 'getRecord',
          settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' }
        },
        {
          id: 'endRecovery',
          type: 'deleteRecord',
          settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'step1Fails', kind: 'next' },
        { id: 'e2', source: 'step1Fails', target: 'step2Errors', kind: 'fault' },
        { id: 'e3', source: 'step2Errors', target: 'endRecovery', kind: 'fault' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('error');
    expect(result.steps).toHaveLength(4);
    expect(result.steps[1]!.status).toBe('failed');
    expect(result.steps[2]!.status).toBe('error');
    expect(result.steps[3]!.status).toBe('passed');
  });

  it('sanitizes long multi-line raw errors to a concise first-line message', async () => {
    const multiLineRawError = new SalesforceError('VALIDATION_ERROR: Invalid stage transition.\nRaw stack:\n  at line 50\n  at payload { ... }');
    vi.spyOn(fakePort, 'createRecord').mockRejectedValue(multiLineRawError);

    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'create1', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'create1', kind: 'next' }]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.steps[1]!.error).toBe('VALIDATION_ERROR: Invalid stage transition.');
  });

  it('fails with plain message when greaterThan or lessThan operands are not numeric', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'decide1',
          type: 'decision',
          settings: { leftOperand: 'notANumber', operator: 'greaterThan', rightOperand: '50' }
        },
        { id: 'trueNode', type: 'assert', settings: { leftOperand: '1', operator: 'equals', rightOperand: '1' } },
        { id: 'falseNode', type: 'assert', settings: { leftOperand: '1', operator: 'equals', rightOperand: '1' } }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'decide1', kind: 'next' },
        { id: 'e2', source: 'decide1', target: 'trueNode', kind: 'true' },
        { id: 'e3', source: 'decide1', target: 'falseNode', kind: 'false' }
      ]
    };

    const result = await runWorkflow(graph, fakePort);
    expect(result.status).toBe('error');
    expect(result.steps[1]!.error).toContain("Comparison 'greaterThan' requires numeric values");
  });

  it('halts execution when runtime step counter exceeds MAX_NODES_PER_WORKFLOW limit', async () => {
    // Build a 101-node linear graph
    const nodes: WorkflowGraph['nodes'] = [{ id: 'start1', type: 'start', settings: {} }];
    const edges: WorkflowGraph['edges'] = [];

    for (let i = 1; i <= 101; i++) {
      const prevId = i === 1 ? 'start1' : `node_${i - 1}`;
      const currentId = `node_${i}`;
      nodes.push({
        id: currentId,
        type: 'getRecord',
        settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' }
      });
      edges.push({ id: `e_${i}`, source: prevId, target: currentId, kind: 'next' });
    }

    // Spy validateGraph to return no errors so this graph reaches the runtime step counter
    vi.spyOn(validateGraphModule, 'validateGraph').mockReturnValue([]);

    const result = await runWorkflow({ nodes, edges }, fakePort);
    expect(result.status).toBe('error');
    // Exactly 100 successful steps ran (1 start + 99 getRecord), plus 1 error step halting at the limit
    expect(result.steps).toHaveLength(101);
    const passedSteps = result.steps.filter((s) => s.status === 'passed');
    expect(passedSteps).toHaveLength(100);

    const limitStep = result.steps[100]!;
    expect(limitStep.status).toBe('error');
    expect(limitStep.error).toBe('Execution step count exceeded maximum limit of 100');
  });
});
