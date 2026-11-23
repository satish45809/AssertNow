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

export interface GetRecordFilter {
  field: string;
  operator: string;
  value: any;
  type?: string;
}

export interface QueryGetRecordsPayload {
  sobject: string;
  fields?: string[];
  filters?: GetRecordFilter[];
  filterLogic?: 'AND' | 'OR';
  orderBy?: string;
  sortDirection?: 'ASC' | 'DESC';
  limit?: number;
  onlyFirstRecord?: boolean;
}

export interface QueryGetRecordsResponse {
  success: boolean;
  sobject: string;
  soql: string;
  totalSize: number;
  done: boolean;
  record?: any;
  records: any[];
  message?: string;
  error?: any;
}

export interface GetRecordFieldMetadata {
  name: string;
  label: string;
  type: string;
  filterable: boolean;
  sortable: boolean;
  picklistValues: Array<{ label: string; value: string }>;
  referenceTo: string[];
}

// ==================== UPDATE RECORD TYPES ====================
export interface UpdateFieldMetadata {
  name: string;
  label: string;
  type: string;
  nillable?: boolean;
  length?: number;
  picklistValues?: Array<{ label: string; value: string }>;
  referenceTo?: string[];
}

export interface UpdateRecordPayload {
  sobject: string;
  recordId: string;
  data: Record<string, any>;
}

export interface BulkUpdatePayload {
  sobject: string;
  records: Array<{ Id: string } & Record<string, any>>;
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
          ApiClient.post('/salesforce/environments/sync', parsed).catch(() => { });
          return parsed;
        }
      }
    } catch { }

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
    } catch { }
    return await ApiClient.get<IntegrationEnvironment>(`/salesforce/environments/${id}`);
  }

  public static async createEnvironment(payload: any): Promise<IntegrationEnvironment> {
    const created = await ApiClient.post<IntegrationEnvironment>('/salesforce/environments', payload);
    try {
      const current = await this.getEnvironments();
      const updated = [created, ...current.filter(e => e.id !== created.id)];
      localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(updated));
    } catch { }
    return created;
  }

  public static async deleteEnvironment(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const current = await this.getEnvironments();
      const updated = current.filter(e => e.id !== id);
      localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(updated));
    } catch { }
    return await ApiClient.delete<{ success: boolean; message?: string }>(`/salesforce/environments/${id}`);
  }

  public static async updateEnvironment(id: string, updates: any): Promise<IntegrationEnvironment> {
    const updated = await ApiClient.patch<IntegrationEnvironment>(`/salesforce/environments/${id}`, updates);
    try {
      const current = await this.getEnvironments();
      const list = current.map(e => e.id === id ? { ...e, ...updated } : e);
      localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(list));
    } catch { }
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

  public static async getLookupRecords(sobjectName: string, search: string = '', limit: number = 50): Promise<Array<{ id: string; name: string }>> {
    const sObj = sobjectName || 'Account';
    const trimmedSearch = (search || '').trim();

    // 1. Prefer new backend route: POST /api/salesforce/get-record/query
    try {
      const payload: QueryGetRecordsPayload = {
        sobject: sObj,
        fields: ['Id', 'Name'],
        filters: trimmedSearch ? [{ field: 'Name', operator: 'LIKE', value: `%${trimmedSearch}%`, type: 'string' }] : [],
        orderBy: 'CreatedDate',
        sortDirection: 'DESC',
        limit: limit || 50,
        onlyFirstRecord: false
      };
      const queryRes = await this.queryGetRecords(payload);
      if (queryRes && Array.isArray(queryRes.records) && queryRes.records.length > 0) {
        return queryRes.records.map((r: any) => ({
          id: r.Id || r.id,
          name: r.Name || r.Subject || r.CaseNumber || r.Username || r.Id || r.id
        }));
      }
    } catch {
      // SObject may not have Name or CreatedDate (e.g. Case, Task) - try Id only query
      try {
        const idQueryRes = await this.queryGetRecords({
          sobject: sObj,
          fields: ['Id'],
          filters: [],
          limit: limit || 50,
          onlyFirstRecord: false
        });
        if (idQueryRes && Array.isArray(idQueryRes.records) && idQueryRes.records.length > 0) {
          return idQueryRes.records.map((r: any) => ({
            id: r.Id || r.id,
            name: r.Id || r.id
          }));
        }
      } catch {
        // Fall through to legacy endpoint
      }
    }

    // 2. Fallback to /create-record/lookup if legacy route exists
    try {
      const encObj = encodeURIComponent(sObj);
      const encQ = encodeURIComponent(trimmedSearch);
      const res: any = await ApiClient.get(`/create-record/lookup?sobject=${encObj}&search=${encQ}&limit=${limit}`);
      return res?.records || [];
    } catch {
      return [];
    }
  }

  public static async checkRecordId(sobjectName: string, recordId: string): Promise<{ exists: boolean; id: string; name?: string; sobject?: string; message?: string }> {
    const cleanId = (recordId || '').trim();
    if (!cleanId) {
      return { exists: false, id: cleanId, message: 'Please provide a valid Salesforce Record ID.' };
    }

    const sObj = sobjectName || 'Account';

    // 1. Try new backend route: GET /api/salesforce/get-record/:sobject/:id
    try {
      const res = await this.getSingleGetRecord(sObj, cleanId, ['Id', 'Name']);
      const rec = res?.record || res;
      if (rec && (rec.Id || rec.id)) {
        return {
          exists: true,
          id: rec.Id || rec.id,
          name: rec.Name || rec.Subject || rec.CaseNumber || rec.Username || rec.Id || rec.id,
          sobject: sObj,
          message: 'Active record verified in Salesforce Org.'
        };
      }
    } catch (err: any) {
      // If 404 from getSingleGetRecord, proceed to query verification
    }

    // 2. Try verifying via POST /api/salesforce/get-record/query
    try {
      const queryRes = await this.queryGetRecords({
        sobject: sObj,
        fields: ['Id', 'Name'],
        filters: [{ field: 'Id', operator: '=', value: cleanId, type: 'string' }],
        limit: 1,
        onlyFirstRecord: true
      });
      const rec = queryRes?.record || queryRes?.records?.[0];
      if (rec && (rec.Id || rec.id)) {
        return {
          exists: true,
          id: rec.Id || rec.id,
          name: rec.Name || rec.Subject || rec.CaseNumber || rec.Username || rec.Id || rec.id,
          sobject: sObj,
          message: 'Active record verified in Salesforce Org.'
        };
      }
    } catch {
      // Query check fallback
    }

    // 3. Fallback to legacy /create-record/check-id if route exists
    try {
      const encObj = encodeURIComponent(sObj);
      const encId = encodeURIComponent(cleanId);
      const legacyRes: any = await ApiClient.get(`/create-record/check-id?sobject=${encObj}&id=${encId}`);
      if (legacyRes && legacyRes.exists !== undefined) {
        return legacyRes;
      }
    } catch {
      // Legacy route not reachable
    }

    // Clean user-friendly not found message (no cryptic HTTP 404 error)
    return {
      exists: false,
      id: cleanId,
      message: `No ${sObj} record matching ID "${cleanId}" was found in your connected Salesforce Org.`
    };
  }

  public static async executeCreateFlow(steps: Array<{ key?: string; nodeId?: string; sobject: string; data: Record<string, any> }>) {
    return await ApiClient.post<{
      success: boolean;
      message: string;
      failedAtStep?: number;
      stepKey?: string;
      sobject?: string;
      context: Record<string, any>;
      executedSteps: Array<{ step: number; key: string; sobject: string; id: string; resolvedData: any }>;
      errors?: any[];
      error?: any;
    }>('/create-record/execute-flow', { steps });
  }

  public static async createRecord(environmentId: string, sobjectName: string, fields: Record<string, any>, stepKey?: string) {
    return await ApiClient.post<{ id: string; success: boolean; message?: string }>(
      '/create-record',
      {
        sobject: sobjectName,
        stepKey,
        data: fields
      }
    );
  }

  public static async createBulkRecords(payload: { sobject: string; records: Array<Record<string, any>> }) {
    return await ApiClient.post<{
      success: boolean;
      message: string;
      createdIds: string[];
      results: Array<{ id: string; success: boolean; errors?: any[] }>;
    }>('/create-record/bulk', payload);
  }

  public static async getCreatableObjects(): Promise<Array<{ name: string; label: string; custom: boolean }>> {
    const res: any = await ApiClient.get<{ success: boolean; objects: Array<{ name: string; label: string; custom: boolean }> }>('/create-record/objects');
    return res?.objects || [];
  }

  public static async getFieldsByObject(sobjectName: string): Promise<any> {
    const query = encodeURIComponent(sobjectName);
    return await ApiClient.get<any>(`/create-record/fields?sobject=${query}`);
  }

  // ==================== GET RECORDS API (/api/salesforce/get-record) ====================
  public static async getGetRecordObjects(): Promise<Array<{ name: string; label: string; custom: boolean }>> {
    const res: any = await ApiClient.get('/get-record/objects');
    return res?.objects || [];
  }

  public static async getGetRecordFields(sobjectName: string): Promise<{
    sobject: string;
    label: string;
    fields: GetRecordFieldMetadata[];
  }> {
    const sObj = encodeURIComponent(sobjectName);
    const res: any = await ApiClient.get(`/get-record/fields?sobject=${sObj}`);
    return res || { sobject: sobjectName, label: sobjectName, fields: [] };
  }

  public static async queryGetRecords(payload: QueryGetRecordsPayload): Promise<QueryGetRecordsResponse> {
    return await ApiClient.post<QueryGetRecordsResponse>('/get-record/query', payload);
  }

  public static async getSingleGetRecord(sobjectName: string, id: string, fields?: string[]): Promise<any> {
    const sObj = encodeURIComponent(sobjectName);
    const safeId = encodeURIComponent(id);
    const query = fields && fields.length > 0 ? `?fields=${encodeURIComponent(fields.join(','))}` : '';
    return await ApiClient.get<any>(`/get-record/${sObj}/${safeId}${query}`);
  }

  public static async getFlowVariables(): Promise<Array<{ token: string; label: string; value: string; sobject: string }>> {
    const res: any = await ApiClient.get<any>('/create-record/variables');
    return res?.variables || [];
  }

  public static async resetFlowContext(): Promise<void> {
    await ApiClient.post('/create-record/reset-context', {}).catch(() => { });
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

  // ==================== UPDATE RECORDS API (/api/salesforce/update-record) ====================
  public static async getUpdateableObjects(): Promise<Array<{ name: string; label: string; custom: boolean }>> {
    const res: any = await ApiClient.get('/update-record/objects');
    return res?.objects || [];
  }

  public static async getUpdateableFields(sobjectName: string): Promise<UpdateFieldMetadata[]> {
    const sObj = encodeURIComponent(sobjectName);
    const res: any = await ApiClient.get(`/update-record/fields?sobject=${sObj}`);
    return res?.fields || [];
  }

  public static async lookupUpdateRecords(sobjectName: string, search?: string, limit?: number): Promise<Array<{ id: string; name: string }>> {
    const sObj = encodeURIComponent(sobjectName);
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const limitParam = limit ? `&limit=${limit}` : '&limit=50';
    const res: any = await ApiClient.get(`/update-record/lookup?sobject=${sObj}${searchParam}${limitParam}`);
    return res?.records || [];
  }

  public static async patchUpdateRecord(payload: UpdateRecordPayload): Promise<any> {
    return await ApiClient.patch<any>('/update-record', payload);
  }

  public static async bulkUpdateRecords(payload: BulkUpdatePayload): Promise<any> {
    return await ApiClient.patch<any>('/update-record/bulk', payload);
  }

  public static async deleteRecord(environmentId: string, sobjectName: string, recordId: string) {
    return await ApiClient.delete<{ id: string; success: boolean }>(
      `/salesforce/environments/${environmentId}/sobjects/${sobjectName}/${recordId}`
    );
  }

  // ==================== DELETE RECORDS API (/api/salesforce/delete-record) ====================
  public static async getDeletableObjects(): Promise<Array<{ name: string; label: string; custom: boolean }>> {
    const res: any = await ApiClient.get('/delete-record/objects');
    return res?.objects || [];
  }

  public static async lookupDeleteRecords(sobjectName: string, search?: string, limit?: number): Promise<Array<{ id: string; name: string }>> {
    const sObj = encodeURIComponent(sobjectName);
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const limitParam = limit ? `&limit=${limit}` : '&limit=50';
    const res: any = await ApiClient.get(`/delete-record/lookup?sobject=${sObj}${searchParam}${limitParam}`);
    return res?.records || [];
  }

  public static async deleteSingleRecord(sobject: string, recordId: string): Promise<any> {
    return await ApiClient.delete<any>('/delete-record', { sobject, recordId });
  }

  public static async deleteBulkRecords(sobject: string, ids: string[]): Promise<any> {
    return await ApiClient.delete<any>('/delete-record/bulk', { sobject, ids });
  }
}
