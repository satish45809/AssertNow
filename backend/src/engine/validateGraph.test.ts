// Tests workflow graph validation against topology rules, edge constraints, settings schemas, and variable references.
// Verifies error messages, multiple problem reporting, cycles, orphans, and edge branches.

import { describe, it, expect } from 'vitest';
import type { WorkflowGraph } from './types.js';
import { validateGraph } from './validateGraph.js';
import { isValidApiName, isValidRelatedFieldName } from './nodeSettings.js';
import { extractVariableReferences } from './references.js';

describe('API Name Validation Rules', () => {
  it('accepts valid API names including custom fields', () => {
    expect(isValidApiName('Name')).toBe(true);
    expect(isValidApiName('AnnualRevenue')).toBe(true);
    expect(isValidApiName('My_Custom_Field__c')).toBe(true);
  });

  it('rejects invalid API names with spaces, dashes, quotes, empty, or over 80 chars', () => {
    expect(isValidApiName('')).toBe(false);
    expect(isValidApiName('Field With Space')).toBe(false);
    expect(isValidApiName('Field-With-Dash')).toBe(false);
    expect(isValidApiName('Field"WithQuote')).toBe(false);
    expect(isValidApiName('A'.repeat(81))).toBe(false);
  });

  it('validates dot-separated related field paths for getRecord', () => {
    expect(isValidRelatedFieldName('Account.Name')).toBe(true);
    expect(isValidRelatedFieldName('Contact.Account.Owner.Name')).toBe(true);
    expect(isValidRelatedFieldName('Account..Name')).toBe(false);
    expect(isValidRelatedFieldName('.Name')).toBe(false);
  });

  it('correctly parses {{create1.Account.Name}} into node create1 and field Account.Name', () => {
    const refs = extractVariableReferences('{{create1.Account.Name}}');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.nodeId).toBe('create1');
    expect(refs[0]!.fieldPath).toBe('Account.Name');
  });

  it('extracts all references when multiple are present in one string', () => {
    const text = 'prefix {{nodeA.field1}} middle {{nodeB.field2}} suffix';
    const refs = extractVariableReferences(text);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.nodeId).toBe('nodeA');
    expect(refs[1]!.nodeId).toBe('nodeB');
  });
});

describe('Workflow Graph Validation', () => {
  it('validates a correct workflow graph without problems', () => {
    const validGraph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'create1',
          type: 'createRecord',
          settings: {
            sobjectName: 'Account',
            fields: { Name: 'Acme Corp', AnnualRevenue: 50000 }
          }
        },
        {
          id: 'get1',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '{{create1.Id}}',
            fields: ['Id', 'Name', 'Account.Name'],
            waitForMilliseconds: 10000,
            pollIntervalMilliseconds: 1000
          }
        },
        {
          id: 'decision1',
          type: 'decision',
          settings: {
            leftOperand: '{{get1.Name}}',
            operator: 'equals',
            rightOperand: 'Acme Corp'
          }
        },
        {
          id: 'assert1',
          type: 'assert',
          settings: {
            leftOperand: '{{get1.Name}}',
            operator: 'equals',
            rightOperand: 'Acme Corp',
            message: 'Account name matches'
          }
        },
        {
          id: 'delete1',
          type: 'deleteRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '{{create1.Id}}'
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'create1', kind: 'next' },
        { id: 'e2', source: 'create1', target: 'get1', kind: 'next' },
        { id: 'e3', source: 'get1', target: 'decision1', kind: 'next' },
        { id: 'e4', source: 'decision1', target: 'assert1', kind: 'true' },
        { id: 'e5', source: 'decision1', target: 'delete1', kind: 'false' }
      ]
    };

    const problems = validateGraph(validGraph);
    expect(problems).toEqual([]);
  });

  it('rejects waitForMilliseconds below 100', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'getTooShort',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            waitForMilliseconds: 99
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'getTooShort', kind: 'next' }]
    };

    const problems = validateGraph(graph);
    expect(problems.some((p) => p.nodeId === 'getTooShort' && p.message.includes('Invalid settings'))).toBe(true);
  });

  it('rejects waitForMilliseconds above 120000', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'getTooLong',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            waitForMilliseconds: 120001
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'getTooLong', kind: 'next' }]
    };

    const problems = validateGraph(graph);
    expect(problems.some((p) => p.nodeId === 'getTooLong' && p.message.includes('Invalid settings'))).toBe(true);
  });

  it('rejects pollIntervalMilliseconds below 50', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'intervalTooShort',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            pollIntervalMilliseconds: 49
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'intervalTooShort', kind: 'next' }]
    };

    const problems = validateGraph(graph);
    expect(problems.some((p) => p.nodeId === 'intervalTooShort' && p.message.includes('Invalid settings'))).toBe(true);
  });

  it('rejects pollIntervalMilliseconds above 30000', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'intervalTooLong',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '001xx000003DHP0AAO',
            pollIntervalMilliseconds: 30001
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'intervalTooLong', kind: 'next' }]
    };

    const problems = validateGraph(graph);
    expect(problems.some((p) => p.nodeId === 'intervalTooLong' && p.message.includes('Invalid settings'))).toBe(true);
  });

  it('reports a problem when the graph is empty', () => {
    const emptyGraph: WorkflowGraph = { nodes: [], edges: [] };
    const problems = validateGraph(emptyGraph);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.message).toContain('at least one node');
  });

  it('reports when start node is missing or multiple start nodes exist', () => {
    const noStart: WorkflowGraph = {
      nodes: [{ id: 'create1', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } }],
      edges: []
    };
    expect(validateGraph(noStart)[0]!.message).toContain('Workflow must have exactly one start node, but none was found');

    const twoStarts: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'start2', type: 'start', settings: {} }
      ],
      edges: []
    };
    expect(validateGraph(twoStarts)[0]!.message).toContain('found 2');
  });

  it('reports duplicate node IDs', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'node1', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } },
        { id: 'node1', type: 'deleteRecord', settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' } }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'node1', kind: 'next' }]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("Duplicate node ID 'node1'"))).toBe(true);
  });

  it('reports edge pointing to non-existent nodes', () => {
    const graph: WorkflowGraph = {
      nodes: [{ id: 'start1', type: 'start', settings: {} }],
      edges: [{ id: 'e1', source: 'start1', target: 'missingNode', kind: 'next' }]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("target node 'missingNode', but that node does not exist"))).toBe(true);
  });

  it('reports orphan nodes that cannot be reached from start', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'orphan1', type: 'deleteRecord', settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' } }
      ],
      edges: []
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("Node 'orphan1' is an orphan"))).toBe(true);
  });

  it('reports decision nodes with missing or invalid true/false edges', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'decision1',
          type: 'decision',
          settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'B' }
        },
        { id: 'assert1', type: 'assert', settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'A' } }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'decision1', kind: 'next' },
        { id: 'e2', source: 'decision1', target: 'assert1', kind: 'next' }
      ]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("Decision node 'decision1' has invalid 'next' outgoing edge"))).toBe(true);
    expect(problems.some((p) => p.message.includes("must have exactly one 'true' edge and one 'false' edge"))).toBe(true);
  });

  it('reports decision node having a fault edge', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'decision1',
          type: 'decision',
          settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'B' }
        },
        { id: 'assert1', type: 'assert', settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'A' } },
        { id: 'assert2', type: 'assert', settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'A' } }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'decision1', kind: 'next' },
        { id: 'e2', source: 'decision1', target: 'assert1', kind: 'true' },
        { id: 'e3', source: 'decision1', target: 'assert2', kind: 'fault' }
      ]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("Decision node 'decision1' has invalid 'fault' outgoing edge"))).toBe(true);
  });

  it('reports start node having a fault edge and nodes with multiple next/fault edges', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'create1', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } },
        { id: 'create2', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'create1', kind: 'fault' },
        { id: 'e2', source: 'start1', target: 'create1', kind: 'next' },
        { id: 'e3', source: 'start1', target: 'create2', kind: 'next' }
      ]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("Start node 'start1' cannot have a 'fault' edge"))).toBe(true);
    expect(problems.some((p) => p.message.includes("Node 'start1' has more than one 'next' edge"))).toBe(true);
  });

  it('reports cycle in the graph with the looped node name', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'step1', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } },
        { id: 'step2', type: 'getRecord', settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' } }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'step1', kind: 'next' },
        { id: 'e2', source: 'step1', target: 'step2', kind: 'next' },
        { id: 'e3', source: 'step2', target: 'step1', kind: 'next' }
      ]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("Cycle detected in workflow: node 'step1' loops back to itself"))).toBe(true);
  });

  it('reports both orphan and cycle when present together', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        { id: 'loopA', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } },
        { id: 'loopB', type: 'createRecord', settings: { sobjectName: 'Account', fields: {} } }
      ],
      edges: [
        { id: 'e1', source: 'loopA', target: 'loopB', kind: 'next' },
        { id: 'e2', source: 'loopB', target: 'loopA', kind: 'next' }
      ]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("is an orphan"))).toBe(true);
    expect(problems.some((p) => p.message.includes("Cycle detected in workflow"))).toBe(true);
  });

  it('validates node settings and rejects dots in createRecord keys and unknown properties', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'badCreate',
          type: 'createRecord',
          settings: {
            sobjectName: 'Account',
            fields: { 'Account.Name': 'InvalidDot' },
            extraKey: 'notAllowed'
          }
        }
      ],
      edges: [{ id: 'e1', source: 'start1', target: 'badCreate', kind: 'next' }]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes('Invalid settings for node'))).toBe(true);
  });

  it('proves {{ghost.Id}} inside fields, leftOperand, and rightOperand is reported as a problem', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'createWithGhost',
          type: 'createRecord',
          settings: {
            sobjectName: 'Account',
            fields: { Description: '{{ghost.Id}}' }
          }
        },
        {
          id: 'decisionWithGhost',
          type: 'decision',
          settings: {
            leftOperand: '{{ghost.Id}}',
            operator: 'equals',
            rightOperand: '{{ghost.Id}}'
          }
        },
        { id: 'end1', type: 'assert', settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'A' } },
        { id: 'end2', type: 'assert', settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'A' } }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'createWithGhost', kind: 'next' },
        { id: 'e2', source: 'createWithGhost', target: 'decisionWithGhost', kind: 'next' },
        { id: 'e3', source: 'decisionWithGhost', target: 'end1', kind: 'true' },
        { id: 'e4', source: 'decisionWithGhost', target: 'end2', kind: 'false' }
      ]
    };

    const problems = validateGraph(graph);

    const createProblems = problems.filter(
      (p) => p.nodeId === 'createWithGhost' && p.message.includes("uses a value from 'ghost', but that node does not exist")
    );
    expect(createProblems).toHaveLength(1);

    const decisionProblems = problems.filter(
      (p) => p.nodeId === 'decisionWithGhost' && p.message.includes("uses a value from 'ghost', but that node does not exist")
    );
    expect(decisionProblems).toHaveLength(2);
  });

  it('proves two references in one string are both validated and missing second node is reported', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'create1',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'Valid' } }
        },
        {
          id: 'create2',
          type: 'createRecord',
          settings: {
            sobjectName: 'Contact',
            fields: { Description: '{{create1.Id}} and {{missingNode.Id}}' }
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'create1', kind: 'next' },
        { id: 'e2', source: 'create1', target: 'create2', kind: 'next' }
      ]
    };

    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("uses a value from 'missingNode', but that node does not exist"))).toBe(true);
  });

  it('rejects references to non-output nodes: start, decision, assert, deleteRecord', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'decision1',
          type: 'decision',
          settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'A' }
        },
        {
          id: 'assert1',
          type: 'assert',
          settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'A' }
        },
        {
          id: 'delete1',
          type: 'deleteRecord',
          settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' }
        },
        {
          id: 'badConsumer',
          type: 'createRecord',
          settings: {
            sobjectName: 'Account',
            fields: {
              F1: '{{start1.id}}',
              F2: '{{decision1.id}}',
              F3: '{{assert1.id}}',
              F4: '{{delete1.id}}'
            }
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'decision1', kind: 'next' },
        { id: 'e2', source: 'decision1', target: 'assert1', kind: 'true' },
        { id: 'e3', source: 'decision1', target: 'delete1', kind: 'false' },
        { id: 'e4', source: 'assert1', target: 'badConsumer', kind: 'next' }
      ]
    };

    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("node type 'start' does not provide any output values"))).toBe(true);
    expect(problems.some((p) => p.message.includes("node type 'decision' does not provide any output values"))).toBe(true);
    expect(problems.some((p) => p.message.includes("node type 'assert' does not provide any output values"))).toBe(true);
    expect(problems.some((p) => p.message.includes("node type 'deleteRecord' does not provide any output values"))).toBe(true);
  });

  it('rejects variable reference when node is on a different branch and not on every path from start', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: {} },
        {
          id: 'decision1',
          type: 'decision',
          settings: { leftOperand: 'A', operator: 'equals', rightOperand: 'A' }
        },
        {
          id: 'trueCreate',
          type: 'createRecord',
          settings: { sobjectName: 'Account', fields: { Name: 'True' } }
        },
        {
          id: 'falseGet',
          type: 'getRecord',
          settings: {
            sobjectName: 'Account',
            recordId: '{{trueCreate.Id}}' // Not on false branch path!
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'decision1', kind: 'next' },
        { id: 'e2', source: 'decision1', target: 'trueCreate', kind: 'true' },
        { id: 'e3', source: 'decision1', target: 'falseGet', kind: 'false' }
      ]
    };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes("'trueCreate' is not executed before 'falseGet' on every path from start"))).toBe(true);
  });

  it('reports when node count exceeds MAX_NODES_PER_WORKFLOW', () => {
    const nodes: WorkflowGraph['nodes'] = [{ id: 'start1', type: 'start', settings: {} }];
    for (let i = 1; i <= 101; i++) {
      nodes.push({
        id: `node_${i}`,
        type: 'deleteRecord',
        settings: { sobjectName: 'Account', recordId: '001xx000003DHP0AAO' }
      });
    }
    const graph: WorkflowGraph = { nodes, edges: [] };
    const problems = validateGraph(graph);
    expect(problems.some((p) => p.message.includes('exceeds the maximum limit of 100'))).toBe(true);
  });

  it('reports multiple concurrent problems together in one list', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start1', type: 'start', settings: { unknownField: true } },
        { id: 'orphan1', type: 'createRecord', settings: { sobjectName: '123InvalidName', fields: {} } }
      ],
      edges: [
        { id: 'e1', source: 'start1', target: 'missingTarget', kind: 'fault' }
      ]
    };
    const problems = validateGraph(graph);
    expect(problems.length).toBeGreaterThan(1);
    expect(problems.some((p) => p.message.includes('orphan'))).toBe(true);
    expect(problems.some((p) => p.message.includes('missingTarget'))).toBe(true);
    expect(problems.some((p) => p.message.includes('Start node'))).toBe(true);
    expect(problems.some((p) => p.message.includes('Invalid settings'))).toBe(true);
  });
});
