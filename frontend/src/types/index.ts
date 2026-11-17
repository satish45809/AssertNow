export type PlatformType = 'salesforce';
export type EnvironmentType = 'production' | 'sandbox' | 'scratch' | 'developer';
export type ConnectionStatus = 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';
export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
export type WorkflowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type UserRole = 'INTERNAL_ADMIN' | 'ORG_ADMIN' | 'END_USER';
export type AuthMethod = 'OAuth 2.0' | 'JWT' | 'Client Credentials';

export interface IntegrationEnvironment {
  id: string;
  organizationId: string;
  name: string;
  platform: 'salesforce';
  environmentType: EnvironmentType;
  authMethod: AuthMethod;
  connectionStatus: ConnectionStatus;
  status: 'ACTIVE' | 'PENDING' | 'ERROR' | 'ONLINE' | 'OFFLINE';
  credentials?: {
    loginUrl?: string;
    instanceUrl?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    accessToken?: string;
    username?: string;
    [key: string]: any;
  };
  instanceUrl?: string;
  accountId?: string;
  apiHealth: number; // percentage e.g. 99.8
  lastVerifiedAt: string;
  lastMetadataSyncAt: string;
  objectCount?: number;
}

export interface MetadataField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  length?: number;
  picklistValues?: string[];
  referenceTo?: string[];
  isCustom: boolean;
}

export interface MetadataObject {
  id: string;
  environmentId: string;
  apiName: string;
  label: string;
  isCustom: boolean;
  isQueryable: boolean;
  fieldsCount: number;
  syncedAt: string;
  fields: MetadataField[];
  relationships: {
    relationshipName: string;
    targetObject: string;
    field: string;
  }[];
}

export interface WorkflowNodeData {
  label: string;
  nodeType: string;
  platform?: 'salesforce' | 'system';
  config: Record<string, any>;
  status?: 'idle' | 'running' | 'passed' | 'failed';
  durationMs?: number;
  outputPreview?: string;
}

export interface FlowResource {
  id: string;
  name: string;
  type: 'VARIABLE' | 'FORMULA' | 'CONSTANT' | 'TEXT_TEMPLATE';
  dataType: 'Text' | 'Number' | 'Currency' | 'Boolean' | 'Date' | 'Record';
  description?: string;
  defaultValue?: string;
  formulaExpression?: string;
  objectType?: string;
  isCollection?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  platform: PlatformType;
  status: WorkflowStatus;
  version: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
  lastExecutionStatus?: ExecutionStatus;
  resources?: FlowResource[];
  graph: {
    nodes: any[];
    edges: any[];
  };
}

export interface ExecutionStepResult {
  id: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  stepOrder: number;
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'RUNNING';
  durationMs: number;
  inputData: any;
  outputData: any;
  assertionResult?: {
    passed: boolean;
    expected: any;
    actual: any;
    operator: string;
    message?: string;
  };
  errorMessage?: string;
}

export interface TestExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  organizationId: string;
  triggerSource: 'MANUAL' | 'SCHEDULED' | 'API';
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  environments: {
    platform: 'salesforce';
    environmentName: string;
    environmentId: string;
  }[];
  errorSummary?: string;
  steps: ExecutionStepResult[];
  logs: {
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    nodeId?: string;
  }[];
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'SUSPENDED';
  lastLoginAt?: string;
  createdAt: string;
}

export interface SubscriptionQuota {
  planName: string;
  usersUsed: number;
  usersMax: number;
  environmentsUsed: number;
  environmentsMax: number;
  monthlyExecutionsUsed: number;
  monthlyExecutionsMax: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  userEmail: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  createdAt: string;
  details: string;
}

