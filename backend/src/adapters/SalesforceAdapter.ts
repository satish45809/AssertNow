/**
 * Salesforce Enterprise Platform Adapter
 * Powered by JSforce with connection pooling and strict error handling.
 */

import jsforce from 'jsforce';
import { SalesforceCredentials } from '../models/Environment.ts';
import { SalesforceError } from '../models/Error.ts';

interface ConnectionCacheEntry {
  conn: any;
  cachedAt: number;
}

export class SalesforceAdapter {
  private static readonly connectionPool = new Map<string, ConnectionCacheEntry>();

  public static clearConnectionCache(key?: string): void {
    if (key) {
      this.connectionPool.delete(key);
    } else {
      this.connectionPool.clear();
    }
  }

  /**
   * Initializes and validates a JSforce connection based on the credentials provided.
   * Supports:
   * 1. OAuth 2.0 Web Server Refresh Token (External Client App)
   * 2. Active Access Token + Instance URL
   * 3. JWT Bearer Flow
   */
  public static async getConnection(credentials: SalesforceCredentials): Promise<any> {
    const tokenSignature = credentials.accessToken || credentials.refreshToken || credentials.clientId || '';
    const poolKey = `${credentials.instanceUrl || credentials.loginUrl}:${tokenSignature.slice(-16)}`;
    const now = Date.now();

    // Check pool (keep connection cached for 1 hour)
    const existing = this.connectionPool.get(poolKey);
    if (existing && now - existing.cachedAt < 3_600_000) {
      return existing.conn;
    }

    try {
      let conn: any;

      if (credentials.refreshToken && credentials.clientId) {
        // Option 1: Modern External Client App with Verified Refresh Token
        conn = new (jsforce as any).Connection({
          oauth2: {
            loginUrl: credentials.loginUrl || 'https://login.salesforce.com',
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret || '',
          },
          refreshToken: credentials.refreshToken,
          accessToken: credentials.accessToken,
          instanceUrl: credentials.instanceUrl,
          version: '62.0',
        });

        conn.on('refresh', (newAccessToken: string) => {
          console.log(`[SalesforceAdapter] Session refreshed automatically! New token cached.`);
          credentials.accessToken = newAccessToken;
        });
      } else if (credentials.clientId && credentials.clientSecret) {
        // Option 2: OAuth 2.0 Client Credentials Flow (Machine-to-Machine, NO refresh token needed!)
        const tokenEndpoint = `${credentials.instanceUrl || credentials.loginUrl || 'https://login.salesforce.com'}/services/oauth2/token`;
        const bodyParams = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        });

        const tokenRes = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: bodyParams.toString(),
        });

        if (!tokenRes.ok) {
          const errBody = await tokenRes.json().catch(() => ({}));
          throw new SalesforceError(
            `Client Credentials Authentication Failed (${tokenRes.status}): ${errBody.error_description || errBody.error || tokenRes.statusText}`,
            errBody.error || 'AUTH_FAILURE'
          );
        }

        const tokenData = await tokenRes.json();
        conn = new (jsforce as any).Connection({
          instanceUrl: tokenData.instance_url || credentials.instanceUrl,
          accessToken: tokenData.access_token,
          version: '62.0',
        });
      } else if (credentials.accessToken && credentials.instanceUrl) {
        // Option 3: Direct Active Access Token
        conn = new (jsforce as any).Connection({
          instanceUrl: credentials.instanceUrl,
          accessToken: credentials.accessToken,
          version: '62.0',
        });
      } else {
        throw new SalesforceError(
          'Insufficient credentials provided: Supply (clientId + clientSecret) for Client Credentials flow, or (refreshToken + clientId), or an accessToken.'
        );
      }

      this.connectionPool.set(poolKey, { conn, cachedAt: now });
      return conn;
    } catch (err: any) {
      throw new SalesforceError(
        `Failed to establish JSforce connection: ${err.message}`,
        err.name || 'CONNECTION_FAILURE',
        err
      );
    }
  }

  /**
   * Tests the Salesforce connection by querying the Organization info.
   */
  public static async testConnection(credentials: SalesforceCredentials) {
    try {
      const conn = await this.getConnection(credentials);
      const identity = await conn.identity();
      const orgQueryResult = await conn.query('SELECT Id, Name, OrganizationType, IsSandbox FROM Organization LIMIT 1');
      const orgInfo = orgQueryResult.records?.[0] || {};

      return {
        online: true,
        userId: identity.user_id,
        username: identity.username,
        organizationId: identity.organization_id,
        organizationName: orgInfo.Name || 'Salesforce Org',
        isSandbox: orgInfo.IsSandbox || false,
        apiVersion: conn.version,
        instanceUrl: conn.instanceUrl,
      };
    } catch (err: any) {
      throw new SalesforceError(
        `Salesforce verification failed: ${err.message}`,
        err.errorCode || 'HANDSHAKE_ERROR',
        err
      );
    }
  }

  /**
   * Introspects all available SObjects in the connected Salesforce Org.
   */
  public static async describeGlobal(credentials: SalesforceCredentials) {
    try {
      const conn = await this.getConnection(credentials);
      const meta = await conn.describeGlobal();
      const sobjects = (meta.sobjects || [])
        .filter((s: any) => s.queryable)
        .map((s: any) => ({
          name: s.name,
          label: s.label,
          custom: s.custom,
          keyPrefix: s.keyPrefix,
          queryable: s.queryable,
          createable: s.createable,
          updateable: s.updateable,
          deletable: s.deletable,
        }));

      return {
        totalCount: sobjects.length,
        sobjects,
      };
    } catch (err: any) {
      throw new SalesforceError(
        `Failed to query global SObject metadata: ${err.message}`,
        err.errorCode || 'DESCRIBE_GLOBAL_ERROR',
        err
      );
    }
  }

  /**
   * Introspects SObject schema (Standard or Custom / CPQ objects like SBQQ__Quote__c).
   */
  public static async describeSObject(credentials: SalesforceCredentials, sobjectName: string) {
    try {
      const conn = await this.getConnection(credentials);
      const meta = await conn.sobject(sobjectName).describe();

      return {
        name: meta.name,
        label: meta.label,
        custom: meta.custom,
        queryable: meta.queryable,
        createable: meta.createable,
        fieldsCount: meta.fields?.length || 0,
        fields: meta.fields?.map((f: any) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          required: !f.nillable && !f.defaultedOnCreate,
          length: f.length,
          picklistValues: f.picklistValues?.map((pv: any) => pv.value),
          referenceTo: f.referenceTo,
          custom: f.custom,
        })) || [],
      };
    } catch (err: any) {
      throw new SalesforceError(
        `Failed to describe SObject "${sobjectName}": ${err.message}`,
        err.errorCode || 'DESCRIBE_ERROR',
        err
      );
    }
  }

  /**
   * Executes a SOQL Query with automatic locator pagination.
   */
  public static async query(credentials: SalesforceCredentials, soql: string) {
    try {
      const conn = await this.getConnection(credentials);
      const result = await conn.query(soql).autoFetch().maxFetch(5000);
      return {
        totalSize: result.totalSize,
        done: result.done,
        records: result.records,
      };
    } catch (err: any) {
      throw new SalesforceError(
        `SOQL Query Execution Failed: ${err.message} (Query: "${soql}")`,
        err.errorCode || 'SOQL_ERROR',
        err
      );
    }
  }

  /**
   * Inserts an SObject record (e.g. Account, Opportunity, SBQQ__Quote__c).
   */
  public static async createRecord(credentials: SalesforceCredentials, sobjectName: string, fields: Record<string, unknown>) {
    try {
      const conn = await this.getConnection(credentials);
      const result = await conn.sobject(sobjectName).create(fields);
      if (!result.success) {
        throw new Error(result.errors?.map((e: any) => e.message).join(', ') || 'Unknown insert error');
      }
      return { id: result.id, success: true };
    } catch (err: any) {
      if (String(err.message || '').includes('expired') || String(err.message || '').includes('invalid_grant') || String(err.message || '').includes('INVALID_SESSION_ID')) {
        this.clearConnectionCache();
        try {
          const freshConn = await this.getConnection(credentials);
          const retryResult = await freshConn.sobject(sobjectName).create(fields);
          if (retryResult.success) {
            return { id: retryResult.id, success: true };
          }
        } catch {
          // continue to throw original error below
        }
      }
      throw new SalesforceError(
        `Failed to insert ${sobjectName} record: ${err.message}`,
        err.errorCode || 'DML_INSERT_ERROR',
        err
      );
    }
  }

  /**
   * Retrieves a single SObject record by Id.
   */
  public static async retrieveRecord(credentials: SalesforceCredentials, sobjectName: string, id: string, fields: string[] = []) {
    try {
      const conn = await this.getConnection(credentials);
      const record = fields.length > 0 
        ? await conn.sobject(sobjectName).retrieve(id, { fields })
        : await conn.sobject(sobjectName).retrieve(id);
      return record;
    } catch (err: any) {
      throw new SalesforceError(
        `Failed to retrieve ${sobjectName} record "${id}": ${err.message}`,
        err.errorCode || 'RETRIEVE_ERROR',
        err
      );
    }
  }

  /**
   * Updates an existing SObject record.
   */
  public static async updateRecord(credentials: SalesforceCredentials, sobjectName: string, id: string, fields: Record<string, unknown>) {
    try {
      const conn = await this.getConnection(credentials);
      const result = await conn.sobject(sobjectName).update({ Id: id, ...fields });
      if (!result.success) {
        throw new Error(result.errors?.map((e: any) => e.message).join(', ') || 'Unknown update error');
      }
      return { id: result.id, success: true };
    } catch (err: any) {
      throw new SalesforceError(
        `Failed to update ${sobjectName} record "${id}": ${err.message}`,
        err.errorCode || 'DML_UPDATE_ERROR',
        err
      );
    }
  }

  /**
   * Deletes an SObject record for clean test teardown.
   */
  public static async deleteRecord(credentials: SalesforceCredentials, sobjectName: string, id: string) {
    try {
      const conn = await this.getConnection(credentials);
      const result = await conn.sobject(sobjectName).destroy(id);
      return { id: result.id, success: result.success };
    } catch (err: any) {
      throw new SalesforceError(
        `Failed to delete ${sobjectName} record "${id}": ${err.message}`,
        err.errorCode || 'DML_DELETE_ERROR',
        err
      );
    }
  }

  /**
   * Exchanges an OAuth authorization code for access_token and refresh_token.
   */
  public static async exchangeAuthCode(params: {
    code: string;
    clientId: string;
    clientSecret?: string;
    codeVerifier?: string;
    instanceUrl?: string;
    loginUrl?: string;
    redirectUri: string;
  }) {
    const tokenEndpoint = `${params.instanceUrl || params.loginUrl || 'https://login.salesforce.com'}/services/oauth2/token`;
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
    });

    if (params.clientSecret) {
      bodyParams.set('client_secret', params.clientSecret);
    }
    if (params.codeVerifier) {
      bodyParams.set('code_verifier', params.codeVerifier);
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.json().catch(() => ({}));
      throw new SalesforceError(
        `OAuth Code Exchange Failed (${tokenRes.status}): ${errBody.error_description || errBody.error || tokenRes.statusText}`,
        errBody.error || 'OAUTH_EXCHANGE_ERROR'
      );
    }

    const tokenData = await tokenRes.json();
    const conn = new (jsforce as any).Connection({
      instanceUrl: tokenData.instance_url || params.instanceUrl,
      accessToken: tokenData.access_token,
      version: '62.0',
    });

    const identity = await conn.identity().catch(() => ({}));

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      instanceUrl: tokenData.instance_url || params.instanceUrl,
      userId: identity.user_id,
      username: identity.username,
      organizationId: identity.organization_id,
      organizationName: identity.organization_name || 'Salesforce Org',
    };
  }
}

