import { 
  IntegrationEnvironment, 
  MetadataObject, 
  WorkflowDefinition, 
  TestExecution, 
  User, 
  SubscriptionQuota, 
  AuditLogEntry 
} from '@/types';

export const mockEnvironments: IntegrationEnvironment[] = [
  {
    id: 'env-sf-prod',
    organizationId: 'org-enterprise-1',
    name: 'Salesforce Enterprise Prod',
    platform: 'salesforce',
    environmentType: 'production',
    authMethod: 'OAuth 2.0',
    connectionStatus: 'HEALTHY',
    status: 'ACTIVE',
    instanceUrl: 'https://na142.salesforce.com',
    apiHealth: 99.98,
    lastVerifiedAt: '2 mins ago',
    lastMetadataSyncAt: '1 hour ago',
    objectCount: 428
  },
  {
    id: 'env-sf-stage',
    organizationId: 'org-enterprise-1',
    name: 'Salesforce Full Sandbox (UAT)',
    platform: 'salesforce',
    environmentType: 'sandbox',
    authMethod: 'JWT',
    connectionStatus: 'HEALTHY',
    status: 'ACTIVE',
    instanceUrl: 'https://cs89.salesforce.com',
    apiHealth: 100.0,
    lastVerifiedAt: '5 mins ago',
    lastMetadataSyncAt: '3 hours ago',
    objectCount: 428
  }
];

export const mockMetadataObjects: MetadataObject[] = [
  {
    id: 'obj-sf-account',
    environmentId: 'env-sf-stage',
    apiName: 'Account',
    label: 'Account',
    isCustom: false,
    isQueryable: true,
    fieldsCount: 64,
    syncedAt: '2026-11-12T08:00:00Z',
    fields: [
      { name: 'Id', label: 'Account ID', type: 'id', required: true, isCustom: false },
      { name: 'Name', label: 'Account Name', type: 'string', required: true, length: 255, isCustom: false },
      { name: 'Type', label: 'Account Type', type: 'picklist', required: false, picklistValues: ['Prospect', 'Customer - Direct', 'Customer - Channel', 'Technology Partner'], isCustom: false },
      { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency', required: false, isCustom: false },
      { name: 'BillingCity', label: 'Billing City', type: 'string', required: false, length: 40, isCustom: false },
      { name: 'NetSuite_Customer_ID__c', label: 'NetSuite Customer ID', type: 'string', required: false, length: 50, isCustom: true },
      { name: 'Sync_Status__c', label: 'ERP Sync Status', type: 'picklist', required: false, picklistValues: ['Pending', 'Synchronized', 'Failed', 'Ignored'], isCustom: true }
    ],
    relationships: [
      { relationshipName: 'Opportunities', targetObject: 'Opportunity', field: 'AccountId' },
      { relationshipName: 'Contacts', targetObject: 'Contact', field: 'AccountId' }
    ]
  },
  {
    id: 'obj-sf-opportunity',
    environmentId: 'env-sf-stage',
    apiName: 'Opportunity',
    label: 'Opportunity',
    isCustom: false,
    isQueryable: true,
    fieldsCount: 78,
    syncedAt: '2026-11-12T08:00:00Z',
    fields: [
      { name: 'Id', label: 'Opportunity ID', type: 'id', required: true, isCustom: false },
      { name: 'AccountId', label: 'Account ID', type: 'reference', required: true, referenceTo: ['Account'], isCustom: false },
      { name: 'Name', label: 'Opportunity Name', type: 'string', required: true, length: 120, isCustom: false },
      { name: 'StageName', label: 'Stage', type: 'picklist', required: true, picklistValues: ['Prospecting', 'Qualification', 'Needs Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'], isCustom: false },
      { name: 'Amount', label: 'Amount', type: 'currency', required: false, isCustom: false },
      { name: 'CloseDate', label: 'Close Date', type: 'date', required: true, isCustom: false },
      { name: 'ERP_Order_Number__c', label: 'ERP Order Number', type: 'string', required: false, length: 40, isCustom: true }
    ],
    relationships: [
      { relationshipName: 'Account', targetObject: 'Account', field: 'AccountId' }
    ]
  },
  {
    id: 'obj-ns-customer',
    environmentId: 'env-ns-sb1',
    apiName: 'customer',
    label: 'Customer (Entity)',
    isCustom: false,
    isQueryable: true,
    fieldsCount: 88,
    syncedAt: '2026-11-12T07:30:00Z',
    fields: [
      { name: 'id', label: 'Internal ID', type: 'integer', required: true, isCustom: false },
      { name: 'entityId', label: 'Customer ID / Name', type: 'string', required: true, length: 83, isCustom: false },
      { name: 'companyName', label: 'Company Name', type: 'string', required: true, length: 100, isCustom: false },
      { name: 'subsidiary', label: 'Primary Subsidiary', type: 'recordRef', required: true, isCustom: false },
      { name: 'email', label: 'Email', type: 'email', required: false, isCustom: false },
      { name: 'currency', label: 'Currency', type: 'recordRef', required: true, isCustom: false },
      { name: 'custentity_sf_account_id', label: 'Salesforce Account ID', type: 'string', required: false, length: 50, isCustom: true }
    ],
    relationships: [
      { relationshipName: 'salesOrders', targetObject: 'salesOrder', field: 'entity' }
    ]
  },
  {
    id: 'obj-ns-salesorder',
    environmentId: 'env-ns-sb1',
    apiName: 'salesOrder',
    label: 'Sales Order (Transaction)',
    isCustom: false,
    isQueryable: true,
    fieldsCount: 112,
    syncedAt: '2026-11-12T07:30:00Z',
    fields: [
      { name: 'id', label: 'Internal ID', type: 'integer', required: true, isCustom: false },
      { name: 'tranId', label: 'Order # (tranId)', type: 'string', required: true, length: 45, isCustom: false },
      { name: 'entity', label: 'Customer', type: 'recordRef', required: true, referenceTo: ['customer'], isCustom: false },
      { name: 'orderStatus', label: 'Status', type: 'picklist', required: true, picklistValues: ['Pending Approval', 'Pending Fulfillment', 'Billed', 'Closed'], isCustom: false },
      { name: 'total', label: 'Total Amount', type: 'currency', required: false, isCustom: false },
      { name: 'custbody_sf_opportunity_id', label: 'Salesforce Opportunity ID', type: 'string', required: false, length: 50, isCustom: true }
    ],
    relationships: [
      { relationshipName: 'customer', targetObject: 'customer', field: 'entity' }
    ]
  }
];

export const mockWorkflows: WorkflowDefinition[] = [
  {
    id: 'wf-lead-to-cash-01',
    organizationId: 'org-enterprise-1',
    name: 'Salesforce Opportunity Close-Won Validation',
    description: 'Creates a test Account & Closed-Won Opportunity in Salesforce, triggers integration pipeline, and asserts financial accuracy.',
    platform: 'salesforce',
    status: 'PUBLISHED',
    version: 4,
    tags: ['E2E', 'Finance', 'Order-to-Cash', 'Regression'],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-12T09:30:00Z',
    lastExecutedAt: '18 mins ago',
    lastExecutionStatus: 'PASSED',
    graph: {
      nodes: [
        {
          id: 'start-1',
          type: 'startNode',
          position: { x: 380, y: 40 },
          data: { label: 'Record-Triggered E2E Suite', nodeType: 'START', config: { triggerType: 'MANUAL' } }
        },
        {
          id: 'sf-create-acc',
          type: 'salesforceNode',
          position: { x: 380, y: 160 },
          data: { 
            label: 'Create Salesforce Account', 
            nodeType: 'CREATE', 
            platform: 'salesforce',
            config: { 
              object: 'Account', 
              operation: 'Create Records (Account)',
              fields: { Name: 'Apex Global QA-{{$timestamp}}', Type: 'Customer - Direct', BillingCity: 'Austin' } 
            } 
          }
        },
        {
          id: 'sf-create-oppty',
          type: 'salesforceNode',
          position: { x: 380, y: 280 },
          data: { 
            label: 'Create Closed-Won Opportunity', 
            nodeType: 'CREATE', 
            platform: 'salesforce',
            config: { 
              object: 'Opportunity', 
              operation: 'Create Records (Opportunity)',
              fields: { 
                Name: 'Annual Enterprise Expansion', 
                AccountId: '{{steps.sf-create-acc.output.id}}', 
                StageName: 'Closed Won', 
                Amount: '$85,000' 
              } 
            } 
          }
        },
        {
          id: 'wait-sync',
          type: 'waitNode',
          position: { x: 380, y: 400 },
          data: { 
            label: 'Pause for ERP Integration Sync', 
            nodeType: 'PAUSE', 
            config: { 
              durationSeconds: 15,
              operation: 'Pause Execution'
            } 
          }
        },
        {
          id: 'ns-find-customer',
          type: 'netsuiteNode',
          position: { x: 380, y: 520 },
          data: { 
            label: 'Get NetSuite Customer Record', 
            nodeType: 'GET', 
            platform: 'netsuite',
            config: { 
              recordType: 'customer', 
              operation: 'Get Records (SuiteTalk REST)',
              searchFilter: "custentity_sf_account_id == '{{steps.sf-create-acc.output.id}}'" 
            } 
          }
        },
        {
          id: 'decision-parity',
          type: 'assertNode',
          position: { x: 380, y: 640 },
          data: { 
            label: 'Decision: Evaluate Data Parity', 
            nodeType: 'DECISION', 
            config: { 
              operation: 'Decision / Assertion Logic',
              assertions: [
                { source: 'steps.ns-find-customer.output.companyName', operator: 'EQUALS', expected: 'steps.sf-create-acc.output.Name' },
                { source: 'steps.ns-find-customer.output.status', operator: 'EXISTS', expected: 'TRUE' }
              ] 
            } 
          }
        },
        {
          id: 'sf-update-status',
          type: 'salesforceNode',
          position: { x: 220, y: 780 },
          data: { 
            label: 'Update SF Sync Status', 
            nodeType: 'UPDATE', 
            platform: 'salesforce',
            config: { 
              object: 'Account', 
              operation: 'Update Records (Account)',
              fields: { Sync_Status__c: 'Synchronized', NetSuite_ID__c: '{{steps.ns-find-customer.output.id}}' } 
            } 
          }
        },
        {
          id: 'end-pass',
          type: 'endNode',
          position: { x: 220, y: 900 },
          data: { label: 'Regression Verified (Pass)', nodeType: 'END', config: { isFault: false } }
        },
        {
          id: 'assign-fault',
          type: 'waitNode',
          position: { x: 540, y: 780 },
          data: { 
            label: 'Assignment: Log Diagnostic Diff', 
            nodeType: 'ASSIGNMENT', 
            config: { 
              operation: 'Assignment (Capture Error)',
              variable: 'varErrorSummary = "ERP Sync Disparity at step ns-find-customer"' 
            } 
          }
        },
        {
          id: 'end-fault',
          type: 'endNode',
          position: { x: 540, y: 900 },
          data: { label: 'Faulted / Test Failed', nodeType: 'END', config: { isFault: true } }
        }
      ],
      edges: [
        { 
          id: 'e1-2', 
          source: 'start-1', 
          target: 'sf-create-acc', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e2-3', 
          source: 'sf-create-acc', 
          target: 'sf-create-oppty', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e3-4', 
          source: 'sf-create-oppty', 
          target: 'wait-sync', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e4-5', 
          source: 'wait-sync', 
          target: 'ns-find-customer', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e5-6', 
          source: 'ns-find-customer', 
          target: 'decision-parity', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e6-pass', 
          source: 'decision-parity', 
          target: 'sf-update-status', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5 },
          data: { label: 'Outcome: Parity Matches' }
        },
        { 
          id: 'e-pass-end', 
          source: 'sf-update-status', 
          target: 'end-pass', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5 } 
        },
        { 
          id: 'e6-fault', 
          source: 'decision-parity', 
          target: 'assign-fault', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' },
          data: { label: 'Fault Path: Disparity' }
        },
        { 
          id: 'e-fault-end', 
          source: 'assign-fault', 
          target: 'end-fault', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' } 
        }
      ]
    }
  },
  {
    id: 'wf-sf-billing-validation',
    organizationId: 'org-enterprise-1',
    name: 'Salesforce CPQ Quote to Contract Integrity Check',
    description: 'Validates line item discounts, multi-currency conversion, and contract renewal dates on CPQ Quote generation.',
    platform: 'salesforce',
    status: 'PUBLISHED',
    version: 2,
    tags: ['Salesforce', 'CPQ', 'Billing'],
    createdAt: '2026-11-04T14:20:00Z',
    updatedAt: '2026-11-10T16:45:00Z',
    lastExecutedAt: '2 hours ago',
    lastExecutionStatus: 'PASSED',
    graph: {
      nodes: [
        {
          id: 'start-cpq',
          type: 'startNode',
          position: { x: 380, y: 40 },
          data: { label: 'Record-Triggered CPQ Suite', nodeType: 'START', config: { triggerType: 'MANUAL' } }
        },
        {
          id: 'sf-get-quote',
          type: 'salesforceNode',
          position: { x: 380, y: 160 },
          data: { 
            label: 'Get CPQ Quote Lines', 
            nodeType: 'GET', 
            platform: 'salesforce',
            config: { 
              object: 'SBQQ__QuoteLine__c', 
              operation: 'Get Records (SOQL)',
              searchFilter: "SBQQ__Quote__c == '{{trigger.quoteId}}'" 
            } 
          }
        },
        {
          id: 'assert-discount',
          type: 'assertNode',
          position: { x: 380, y: 280 },
          data: { 
            label: 'Decision: Validate Discount Threshold', 
            nodeType: 'DECISION', 
            config: { 
              rules: 'SBQQ__Discount__c <= 20.00 [AND] SBQQ__NetPrice__c > 0', 
              outcomePass: 'Approved Range', 
              outcomeFail: 'Discount Escalation' 
            } 
          }
        },
        {
          id: 'sf-create-contract',
          type: 'salesforceNode',
          position: { x: 220, y: 420 },
          data: { 
            label: 'Create Salesforce Contract', 
            nodeType: 'CREATE', 
            platform: 'salesforce',
            config: { 
              object: 'Contract', 
              operation: 'Create Records (Contract DML)',
              fields: { AccountId: '{{steps.sf-get-quote.output.AccountId}}', Status: 'Draft', ContractTerm: '12' } 
            } 
          }
        },
        {
          id: 'assign-audit',
          type: 'waitNode',
          position: { x: 220, y: 550 },
          data: { 
            label: 'Assignment: Log CPQ Audit Trail', 
            nodeType: 'ASSIGNMENT', 
            config: { 
              operation: 'Set Variables',
              variable: 'varCPQVerdict = "VALIDATED_COMPLIANT"' 
            } 
          }
        },
        {
          id: 'end-pass-cpq',
          type: 'endNode',
          position: { x: 220, y: 680 },
          data: { label: 'Regression Verified (Pass)', nodeType: 'END', config: { isFault: false } }
        },
        {
          id: 'assign-fault-cpq',
          type: 'waitNode',
          position: { x: 540, y: 420 },
          data: { 
            label: 'Assignment: Flag Unauthorized Discount', 
            nodeType: 'ASSIGNMENT', 
            config: { 
              operation: 'Assignment (Capture Error)',
              variable: 'varErrorSummary = "Discount exceeded 20% cap without VP approval"' 
            } 
          }
        },
        {
          id: 'end-fault-cpq',
          type: 'endNode',
          position: { x: 540, y: 550 },
          data: { label: 'Faulted / Test Failed', nodeType: 'END', config: { isFault: true } }
        }
      ],
      edges: [
        { 
          id: 'e-cpq-1', 
          source: 'start-cpq', 
          target: 'sf-get-quote', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e-cpq-2', 
          source: 'sf-get-quote', 
          target: 'assert-discount', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e-cpq-pass', 
          source: 'assert-discount', 
          target: 'sf-create-contract', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5 },
          data: { label: 'Outcome: Approved (<=20%)' }
        },
        { 
          id: 'e-cpq-contract', 
          source: 'sf-create-contract', 
          target: 'assign-audit', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e-cpq-final', 
          source: 'assign-audit', 
          target: 'end-pass-cpq', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e-cpq-fault', 
          source: 'assert-discount', 
          target: 'assign-fault-cpq', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' },
          data: { label: 'Fault Path: Over-Discounted' }
        },
        { 
          id: 'e-cpq-fault-end', 
          source: 'assign-fault-cpq', 
          target: 'end-fault-cpq', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' } 
        }
      ]
    }
  },
  {
    id: 'wf-sf-security-audit',
    organizationId: 'org-enterprise-1',
    name: 'Salesforce Security & Permission Sets Audit',
    description: 'Validates field level security and object permissions.',
    platform: 'salesforce',
    status: 'DRAFT',
    version: 1,
    tags: ['NetSuite', 'Supply Chain', 'Inventory'],
    createdAt: '2026-11-09T11:15:00Z',
    updatedAt: '2026-11-12T04:10:00Z',
    lastExecutedAt: 'Yesterday',
    lastExecutionStatus: 'FAILED',
    graph: {
      nodes: [
        {
          id: 'start-ns',
          type: 'startNode',
          position: { x: 380, y: 40 },
          data: { label: 'Schedule-Triggered Inventory Sync', nodeType: 'START', config: { triggerType: 'SCHEDULE' } }
        },
        {
          id: 'ns-get-fulfillments',
          type: 'netsuiteNode',
          position: { x: 380, y: 160 },
          data: { 
            label: 'Get NetSuite Item Fulfillments', 
            nodeType: 'GET', 
            platform: 'netsuite',
            config: { 
              recordType: 'itemFulfillment', 
              operation: 'Get Records (SuiteTalk REST)',
              searchFilter: "status == 'Shipped' [AND] tranDate == 'today'" 
            } 
          }
        },
        {
          id: 'wait-warehouse',
          type: 'waitNode',
          position: { x: 380, y: 280 },
          data: { 
            label: 'Pause for EDI Middleware Queue', 
            nodeType: 'PAUSE', 
            config: { 
              durationSeconds: 10,
              operation: 'Warehouse Stock Sync Buffer' 
            } 
          }
        },
        {
          id: 'decision-lot',
          type: 'assertNode',
          position: { x: 380, y: 400 },
          data: { 
            label: 'Decision: Verify Lot & Bin Allocation', 
            nodeType: 'DECISION', 
            config: { 
              rules: 'lotNumber == expectedLot [AND] location == "East Coast DC"', 
              outcomePass: 'Lot & Bin Matched', 
              outcomeFail: 'Discrepancy Detected' 
            } 
          }
        },
        {
          id: 'ns-update-inventory',
          type: 'netsuiteNode',
          position: { x: 220, y: 540 },
          data: { 
            label: 'Update NetSuite Inventory Balance', 
            nodeType: 'UPDATE', 
            platform: 'netsuite',
            config: { 
              recordType: 'inventoryItem', 
              operation: 'Update Records (Inventory DML)',
              fields: { custitem_reconciled: 'true', lastAuditTimestamp: '{{$timestamp}}' } 
            } 
          }
        },
        {
          id: 'end-pass-ns',
          type: 'endNode',
          position: { x: 220, y: 670 },
          data: { label: 'Inventory Reconciled (Pass)', nodeType: 'END', config: { isFault: false } }
        },
        {
          id: 'assign-fault-ns',
          type: 'waitNode',
          position: { x: 540, y: 540 },
          data: { 
            label: 'Assignment: Capture Bin Discrepancy', 
            nodeType: 'ASSIGNMENT', 
            config: { 
              operation: 'Assignment (Capture Error)',
              variable: 'varErrorSummary = "Lot mismatch between EDI order and NetSuite warehouse bin"' 
            } 
          }
        },
        {
          id: 'end-fault-ns',
          type: 'endNode',
          position: { x: 540, y: 670 },
          data: { label: 'Discrepancy Fault / Test Failed', nodeType: 'END', config: { isFault: true } }
        }
      ],
      edges: [
        { 
          id: 'e-ns-1', 
          source: 'start-ns', 
          target: 'ns-get-fulfillments', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e-ns-2', 
          source: 'ns-get-fulfillments', 
          target: 'wait-warehouse', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e-ns-3', 
          source: 'wait-warehouse', 
          target: 'decision-lot', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e-ns-pass', 
          source: 'decision-lot', 
          target: 'ns-update-inventory', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5 },
          data: { label: 'Outcome: Lot & Bin Matched' }
        },
        { 
          id: 'e-ns-update', 
          source: 'ns-update-inventory', 
          target: 'end-pass-ns', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#94a3b8', strokeWidth: 2 } 
        },
        { 
          id: 'e-ns-fault', 
          source: 'decision-lot', 
          target: 'assign-fault-ns', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' },
          data: { label: 'Fault Path: Bin Mismatch' }
        },
        { 
          id: 'e-ns-fault-end', 
          source: 'assign-fault-ns', 
          target: 'end-fault-ns', 
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'flowConnector',
          style: { stroke: '#64748b', strokeWidth: 1.5, strokeDasharray: '4 4' } 
        }
      ]
    }
  }
];

export const mockExecutions: TestExecution[] = [
  {
    id: 'exec-8491',
    workflowId: 'wf-lead-to-cash-01',
    workflowName: 'Salesforce Oppty Close-Won → NetSuite Sales Order Sync Validation',
    workflowVersion: 4,
    organizationId: 'org-enterprise-1',
    triggerSource: 'MANUAL',
    status: 'PASSED',
    startedAt: '2026-11-12T07:42:10Z',
    completedAt: '2026-11-12T07:42:32Z',
    durationMs: 22400,
    totalSteps: 6,
    passedSteps: 6,
    failedSteps: 0,
    environments: [
      { platform: 'salesforce', environmentName: 'Salesforce Full Sandbox (UAT)', environmentId: 'env-sf-stage' },
      { platform: 'salesforce', environmentName: 'Salesforce Developer Edition', environmentId: 'env-sf-dev' }
    ],
    steps: [
      {
        id: 'step-1',
        nodeId: 'start-1',
        nodeLabel: 'Workflow Trigger',
        nodeType: 'START',
        stepOrder: 1,
        status: 'PASSED',
        durationMs: 40,
        inputData: { trigger: 'MANUAL', user: 'tester@enterprise.com' },
        outputData: { executionContextId: 'ctx_9182918' }
      },
      {
        id: 'step-2',
        nodeId: 'sf-create-acc',
        nodeLabel: 'Create SF Account',
        nodeType: 'SF_CREATE',
        stepOrder: 2,
        status: 'PASSED',
        durationMs: 1420,
        inputData: { object: 'Account', fields: { Name: 'Apex Global Corp QA-1731404530', Type: 'Customer - Direct' } },
        outputData: { id: '0015g00001Z9aXpAAJ', Name: 'Apex Global Corp QA-1731404530', created: true }
      },
      {
        id: 'step-3',
        nodeId: 'sf-create-oppty',
        nodeLabel: 'Create SF Opportunity',
        nodeType: 'SF_CREATE',
        stepOrder: 3,
        status: 'PASSED',
        durationMs: 1680,
        inputData: { object: 'Opportunity', fields: { AccountId: '0015g00001Z9aXpAAJ', StageName: 'Closed Won', Amount: 85000 } },
        outputData: { id: '0065g00000bKl89AAC', StageName: 'Closed Won', Amount: 85000 }
      },
      {
        id: 'step-4',
        nodeId: 'wait-sync',
        nodeLabel: 'Wait for ERP Webhook (15s)',
        nodeType: 'WAIT',
        stepOrder: 4,
        status: 'PASSED',
        durationMs: 15002,
        inputData: { seconds: 15 },
        outputData: { waited: true }
      },
      {
        id: 'step-5',
        nodeId: 'ns-find-customer',
        nodeLabel: 'Query NetSuite Customer',
        nodeType: 'NS_SEARCH',
        stepOrder: 5,
        status: 'PASSED',
        durationMs: 2450,
        inputData: { recordType: 'customer', filter: "custentity_sf_account_id == '0015g00001Z9aXpAAJ'" },
        outputData: { internalId: 48921, companyName: 'Apex Global Corp QA-1731404530', status: 'CUSTOMER_ACTIVE' }
      },
      {
        id: 'step-6',
        nodeId: 'assert-match',
        nodeLabel: 'Verify Cross-Platform Match',
        nodeType: 'ASSERTION',
        stepOrder: 6,
        status: 'PASSED',
        durationMs: 110,
        inputData: {
          fieldA: 'Apex Global Corp QA-1731404530',
          fieldB: 'Apex Global Corp QA-1731404530'
        },
        outputData: { match: true },
        assertionResult: {
          passed: true,
          operator: 'EQUALS',
          expected: 'Apex Global Corp QA-1731404530',
          actual: 'Apex Global Corp QA-1731404530',
          message: 'Salesforce Account Name strictly matches NetSuite Entity Company Name.'
        }
      }
    ],
    logs: [
      { timestamp: '07:42:10.102', level: 'INFO', message: 'Job claimed by execution-worker-01 (lease valid 120s)' },
      { timestamp: '07:42:10.150', level: 'INFO', message: 'Loaded workflow definition version 4 (6 nodes verified)' },
      { timestamp: '07:42:10.220', level: 'INFO', message: 'Salesforce connection established (Session ID validated via JSforce)' },
      { timestamp: '07:42:11.642', level: 'INFO', message: 'SF Insert Account successful: Id=0015g00001Z9aXpAAJ' },
      { timestamp: '07:42:13.322', level: 'INFO', message: 'SF Insert Opportunity successful: Id=0065g00000bKl89AAC' },
      { timestamp: '07:42:13.330', level: 'INFO', message: 'Awaiting sync delay of 15 seconds...' },
      { timestamp: '07:42:28.340', level: 'INFO', message: 'NetSuite SuiteTalk REST search executed (querying custentity_sf_account_id)' },
      { timestamp: '07:42:30.790', level: 'INFO', message: 'NetSuite matched Customer Entity ID: 48921' },
      { timestamp: '07:42:31.900', level: 'INFO', message: 'ASSERTION EQUALS PASSED: Source matches target with 100% field parity' },
      { timestamp: '07:42:32.400', level: 'INFO', message: 'Execution finished with state: PASSED' }
    ]
  },
  {
    id: 'exec-8488',
    workflowId: 'wf-ns-inventory-reconciliation',
    workflowName: 'NetSuite Multi-Location Inventory & Fulfillment Guard',
    workflowVersion: 1,
    organizationId: 'org-enterprise-1',
    triggerSource: 'SCHEDULED',
    status: 'FAILED',
    startedAt: '2026-11-11T18:00:00Z',
    completedAt: '2026-11-11T18:00:48Z',
    durationMs: 48000,
    totalSteps: 5,
    passedSteps: 3,
    failedSteps: 1,
    environments: [
      { platform: 'salesforce', environmentName: 'Salesforce Production Org', environmentId: 'env-sf-prod' }
    ],
    errorSummary: 'Assertion Failed: Inventory item quantity on hand at West Warehouse expected >= 50, found 12.',
    steps: [],
    logs: [
      { timestamp: '18:00:00.010', level: 'INFO', message: 'Execution scheduled trigger initiated' },
      { timestamp: '18:00:45.310', level: 'ERROR', message: 'Assertion check failed on step 4' }
    ]
  }
];

export const mockUsers: User[] = [
  {
    id: 'usr-1',
    email: 'admin@assertnow.io',
    firstName: 'Devon',
    lastName: 'Vance',
    role: 'ORG_ADMIN',
    status: 'ACTIVE',
    lastLoginAt: '12 mins ago',
    createdAt: '2026-10-01'
  },
  {
    id: 'usr-2',
    email: 'sarah.qa@assertnow.io',
    firstName: 'Sarah',
    lastName: 'Chen',
    role: 'END_USER',
    status: 'ACTIVE',
    lastLoginAt: '1 hour ago',
    createdAt: '2026-10-15'
  },
  {
    id: 'usr-3',
    email: 'marcus.eng@assertnow.io',
    firstName: 'Marcus',
    lastName: 'Brody',
    role: 'END_USER',
    status: 'ACTIVE',
    lastLoginAt: '3 days ago',
    createdAt: '2026-10-20'
  }
];

export const mockSubscriptionQuota: SubscriptionQuota = {
  planName: 'Enterprise Growth (Dual Platform)',
  usersUsed: 3,
  usersMax: 15,
  environmentsUsed: 4,
  environmentsMax: 10,
  monthlyExecutionsUsed: 412,
  monthlyExecutionsMax: 2500,
  billingPeriodStart: '2026-11-01',
  billingPeriodEnd: '2026-11-30'
};

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'aud-991',
    action: 'WORKFLOW_PUBLISHED',
    userEmail: 'devon@assertnow.io',
    resourceType: 'test_workflows',
    resourceId: 'wf-lead-to-cash-01',
    ipAddress: '192.168.1.14',
    createdAt: '2026-11-12T09:30:00Z',
    details: 'Published version 4 of Salesforce → NetSuite Order-to-Cash workflow.'
  },
  {
    id: 'aud-990',
    action: 'ENVIRONMENT_VERIFIED',
    userEmail: 'system',
    resourceType: 'integration_environments',
    resourceId: 'env-sf-stage',
    ipAddress: '127.0.0.1',
    createdAt: '2026-11-12T09:00:00Z',
    details: 'Automated health ping verified with 100% latency SLA.'
  },
  {
    id: 'aud-989',
    action: 'USER_INVITED',
    userEmail: 'devon@assertnow.io',
    resourceType: 'users',
    resourceId: 'usr-3',
    ipAddress: '192.168.1.14',
    createdAt: '2026-11-10T14:12:00Z',
    details: 'Invited Marcus Brody with END_USER role.'
  }
];
