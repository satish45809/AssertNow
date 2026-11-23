/**
 * Test Log API Service
 * Communicates with the backend workflow_test_logs table via REST API.
 * Tracks RUNNING -> PASSED / FAILED lifecycle of workflow test executions.
 */

import { ApiClient } from './ApiClient';
import type {
  BackendTestLog,
  TestLogResponse,
  TestLogsListResponse,
} from '../types/api';

export type { BackendTestLog };

export class TestLogApi {
  /**
   * POST /api/salesforce/test-logs
   * Creates a new RUNNING test log entry. Call this BEFORE executing workflow steps.
   */
  public static async create(params: {
    workflowId: number | null;
    triggerType?: string;
    stepLogs?: any[];
  }): Promise<BackendTestLog> {
    const res = await ApiClient.post<any>('/test-logs', {
      workflowId: params.workflowId,
      triggerType: params.triggerType || 'MANUAL',
      stepLogs: params.stepLogs || [],
    });
    return res?.log || res;
  }

  /**
   * PATCH /api/salesforce/test-logs/:logId
   * Marks an existing test log as PASSED or FAILED with final step data.
   * Call this in the finally block after workflow execution completes.
   */
  public static async complete(
    logId: number,
    params: {
      status: 'PASSED' | 'FAILED';
      durationMs: number;
      errorMessage?: string | null;
      stepLogs: any[];
    }
  ): Promise<BackendTestLog> {
    const res = await ApiClient.patch<any>(`/test-logs/${logId}`, {
      status: params.status,
      durationMs: params.durationMs,
      errorMessage: params.errorMessage || null,
      stepLogs: params.stepLogs || [],
    });
    return res?.log || res;
  }

  /**
   * GET /api/salesforce/test-logs?workflowId=<id>&limit=50
   * Retrieves test log history from PostgreSQL. Filterable by workflowId.
   */
  public static async list(params?: {
    workflowId?: number;
    limit?: number;
  }): Promise<BackendTestLog[]> {
    const parts: string[] = [];
    if (params?.workflowId) parts.push(`workflowId=${params.workflowId}`);
    if (params?.limit) parts.push(`limit=${params.limit}`);
    const query = parts.length > 0 ? `?${parts.join('&')}` : '';

    const res = await ApiClient.get<any>(`/test-logs${query}`);
    return res?.logs || (Array.isArray(res) ? res : []);
  }
}
