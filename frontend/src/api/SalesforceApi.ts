/**
 * Salesforce Enterprise API Service
 * Interacts with backend Salesforce adapter (environments, verify, describe, SOQL).
 */

import { ApiClient } from './ApiClient';
import { IntegrationEnvironment } from '../types';

export interface VerifyConnectionPayload {
  loginUrl: string;
  clientId: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  instanceUrl?: string;
}

export interface VerifyConnectionResponse {
  online: boolean;
  userId: string;
  username: string;
  organizationId: string;
  organizationName: string;
  isSandbox: boolean;
  apiVersion: string;
  instanceUrl: string;
}

export interface SObjectSchemaResponse {
  name: string;
  label: string;
  custom: boolean;
  queryable: boolean;
  createable: boolean;
  fieldsCount: number;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
    length?: number;
    picklistValues?: string[];
    referenceTo?: string[];
    custom: boolean;
  }>;
}

const ENV_STORAGE_KEY = 'assertnow_environments';

export class SalesforceApi {
  public static async getEnvironments(): Promise<IntegrationEnvironment[]> {
    try {
      const stored = localStorage.getItem(ENV_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sync client localStorage to backend in-memory cache
          ApiClient.post('/salesforce/environments/sync', parsed).catch(() => {});
          return parsed;
        }
      }
    } catch {}

    return [];
  }

  public static async getEnvironmentById(id: string): Promise<IntegrationEnvironment> {
    try {
      const stored = localStorage.getItem(ENV_STORAGE_KEY);
      if (stored) {
        const parsed: IntegrationEnvironment[] = JSON.parse(stored);
        const match = parsed.find(e => e.id === id);
        if (match) return match;
      }
    } catch {}
    return await ApiClient.get<IntegrationEnvironment>(`/salesforce/environments/${id}`);
  }

  public static async createEnvironment(payload: any): Promise<IntegrationEnvironment> {
    const created = await ApiClient.post<IntegrationEnvironment>('/salesforce/environments', payload);
    try {
      const current = await this.getEnvironments();
      const updated = [created, ...current.filter(e => e.id !== created.id)];
      localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return created;
  }

  public static async deleteEnvironment(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const current = await this.getEnvironments();
      const updated = current.filter(e => e.id !== id);
      localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return await ApiClient.delete<{ success: boolean; message?: string }>(`/salesforce/environments/${id}`);
  }

  public static async updateEnvironment(id: string, updates: any): Promise<IntegrationEnvironment> {
    const updated = await ApiClient.patch<IntegrationEnvironment>(`/salesforce/environments/${id}`, updates);
    try {
      const current = await this.getEnvironments();
      const list = current.map(e => e.id === id ? { ...e, ...updated } : e);
      localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(list));
    } catch {}
    return updated;
  }

  public static async connect(payload: { myDomain: string; clientId: string; clientSecret: string }): Promise<any> {
    return await ApiClient.post('/connect', payload);
  }

  public static async getStatus(): Promise<any> {
    return await ApiClient.get('/status');
  }

  public static async testEnvironmentById(id: string): Promise<any> {
    try {
      const statusRes: any = await ApiClient.get('/status');
      if (statusRes?.isConnected) {
        return {
          online: true,
          instanceUrl: statusRes.instanceUrl || statusRes.myDomain,
          organizationName: 'Connected Salesforce Org',
          organizationId: 'Active Session',
          apiVersion: '60.0',
          username: 'OAuth Client'
        };
      }
      return await ApiClient.get('/test-query');
    } catch {
      return await ApiClient.get('/test-query');
    }
  }

  public static async verifyConnection(credentials: VerifyConnectionPayload): Promise<VerifyConnectionResponse> {
    const myDomain = credentials.loginUrl || credentials.instanceUrl || '';
    const clientId = credentials.clientId || '';
    const clientSecret = credentials.clientSecret || '';

    // If client credentials provided, directly call backend /connect
    if (clientId && clientSecret && myDomain) {
      const res: any = await this.connect({ myDomain, clientId, clientSecret });
      return {
        online: true,
        userId: 'ClientCredentialsUser',
        username: 'Connected App User',
        organizationId: res?.data?.instanceUrl || 'Salesforce Org',
        organizationName: 'Salesforce Org',
        isSandbox: myDomain.includes('sandbox') || myDomain.includes('test'),
        apiVersion: '60.0',
        instanceUrl: res?.data?.instanceUrl || myDomain
      };
    }

    // Fallback status check
    const status: any = await this.getStatus().catch(() => null);
    if (status?.isConnected) {
      return {
        online: true,
        userId: 'ActiveUser',
        username: 'Connected App User',
        organizationId: status?.instanceUrl || 'Salesforce Org',
        organizationName: 'Salesforce Org',
        isSandbox: false,
        apiVersion: '60.0',
        instanceUrl: status?.instanceUrl || myDomain
      };
    }

    throw new Error('Please provide valid Salesforce My Domain URL, Client ID, and Client Secret.');
  }

  public static async exchangeCode(params: {
    code: string;
    clientId: string;
    clientSecret?: string;
    codeVerifier?: string;
    instanceUrl?: string;
    redirectUri: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    instanceUrl: string;
    userId?: string;
    username?: string;
    organizationId?: string;
    organizationName?: string;
  }> {
    return await ApiClient.post('/salesforce/oauth/exchange', params);
  }

  public static async listSObjects(environmentId: string): Promise<{
    totalCount: number;
    sobjects: Array<{
      name: string;
      label: string;
      custom: boolean;
      keyPrefix?: string;
      queryable: boolean;
      createable: boolean;
      updateable: boolean;
      deletable: boolean;
    }>;
  }> {
    const res: any = await ApiClient.get(`/salesforce/environments/${environmentId}/sobjects`);
    return res?.data !== undefined ? res.data : res;
  }

  public static async describeSObject(environmentId: string, sobjectName: string): Promise<SObjectSchemaResponse> {
    return await ApiClient.get<SObjectSchemaResponse>(`/salesforce/environments/${environmentId}/describe/${sobjectName}`);
  }

  public static async executeQuery(environmentId: string, soql: string) {
    return await ApiClient.get<{ success: boolean; records: any[] }>(
      '/test-query'
    );
  }

  public static async createRecord(environmentId: string, sobjectName: string, fields: Record<string, any>) {
    return await ApiClient.post<{ id: string; success: boolean; message?: string }>(
      '/create-record',
      {
        sobject: sobjectName,
        data: fields
      }
    );
  }

  public static async getCreatableObjects(): Promise<Array<{ name: string; label: string; custom: boolean }>> {
    const res: any = await ApiClient.get<{ success: boolean; objects: Array<{ name: string; label: string; custom: boolean }> }>('/create-record/objects');
    return res?.objects || [];
  }

  public static async getFieldsByObject(sobjectName: string): Promise<any> {
    const query = encodeURIComponent(sobjectName);
    return await ApiClient.get<any>(`/create-record/fields?sobject=${query}`);
  }

  public static async getFlowVariables(): Promise<Array<{ token: string; label: string; value: string; sobject: string }>> {
    const res: any = await ApiClient.get<any>('/create-record/variables');
    return res?.variables || [];
  }

  public static async resetFlowContext(): Promise<void> {
    await ApiClient.post('/create-record/reset-context', {}).catch(() => {});
  }

  public static async retrieveRecord(environmentId: string, sobjectName: string, recordId: string, fields?: string[]) {
    const query = fields && fields.length > 0 ? `?fields=${fields.join(',')}` : '';
    return await ApiClient.get<any>(
      `/salesforce/environments/${environmentId}/sobjects/${sobjectName}/${recordId}${query}`
    );
  }

  public static async updateRecord(environmentId: string, sobjectName: string, recordId: string, fields: Record<string, any>) {
    return await ApiClient.patch<{ id: string; success: boolean }>(
      `/salesforce/environments/${environmentId}/sobjects/${sobjectName}/${recordId}`,
      fields
    );
  }

  public static async deleteRecord(environmentId: string, sobjectName: string, recordId: string) {
    return await ApiClient.delete<{ id: string; success: boolean }>(
      `/salesforce/environments/${environmentId}/sobjects/${sobjectName}/${recordId}`
    );
  }
}
