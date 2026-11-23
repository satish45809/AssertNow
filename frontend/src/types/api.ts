/**
 * Backend API Response Types
 * Exact shapes matching the Node.js/Express + PostgreSQL (Assert_Now) backend.
 */

// ==================== CONNECTION & SESSION (salesforce_connections) ====================

export interface ConnectionStatus {
  isConnected: boolean;
  connectionId: number | null;
  name: string | null;
  myDomain: string | null;
  instanceUrl: string | null;
  tokenExpiresAt: string | null;
}

export interface ConnectRequest {
  name: string;
  myDomain: string;
  clientId: string;
  clientSecret: string;
}

export interface ConnectResponse {
  success: boolean;
  message: string;
  data: ConnectionStatus;
}

export interface StatusResponse {
  success: boolean;
  data: ConnectionStatus;
}

export interface TestQueryResponse {
  success: boolean;
  records: any[];
}

export interface DisconnectResponse {
  success: boolean;
  message: string;
}

// ==================== WORKFLOWS (workflows table) ====================

export interface BackendWorkflow {
  id: number;
  connection_id: number | null;
  name: string;
  description: string | null;
  version: number;
  definition: {
    nodes: any[];
    edges: any[];
    resources?: any[];
  };
  created_at: string;
  updated_at: string;
}

export interface WorkflowsListResponse {
  success: boolean;
  workflows: BackendWorkflow[];
}

export interface WorkflowResponse {
  success: boolean;
  workflow: BackendWorkflow;
  message?: string;
}

export interface WorkflowDeleteResponse {
  success: boolean;
  message: string;
  deleted?: { id: number; name: string };
}

// ==================== TEST LOGS (workflow_test_logs table) ====================

export interface BackendTestLog {
  id: number;
  workflow_id: number | null;
  connection_id: number | null;
  status: 'RUNNING' | 'PASSED' | 'FAILED';
  trigger_type: string;
  step_logs: any[];
  error_message: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface TestLogCreateRequest {
  workflowId: number | null;
  triggerType?: string;
  stepLogs?: any[];
}

export interface TestLogCompleteRequest {
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  errorMessage?: string | null;
  stepLogs: any[];
}

export interface TestLogResponse {
  success: boolean;
  log: BackendTestLog;
}

export interface TestLogsListResponse {
  success: boolean;
  logs: BackendTestLog[];
}
