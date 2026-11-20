// Adapts jsforce calls to our application error types and lifecycle requirements.
// Enforces read-only safety when writes are disabled and retries on session expiration.

import jsforce from 'jsforce';
import type { AuthStrategy } from './auth/authStrategy.js';
import { env } from '../../config/env.js';
import { SalesforceError, ConnectionError, ValidationError } from '../../utils/errors.js';
import { validateIdentifier, validateRecordId } from './soqlHelper.js';

export interface SalesforceAdapterConfig {
  environmentId: string;
  authStrategy: AuthStrategy;
  allowWrites?: boolean;
}

export class SalesforceAdapter {
  public readonly environmentId: string;
  private readonly authStrategy: AuthStrategy;
  private readonly allowWrites: boolean;
  private connection: jsforce.Connection | null = null;

  constructor(config: SalesforceAdapterConfig) {
    if (!config.environmentId || config.environmentId.trim() === '') {
      throw new ValidationError('environmentId is required');
    }
    this.environmentId = config.environmentId;
    this.authStrategy = config.authStrategy;
    this.allowWrites = config.allowWrites ?? false;
  }

  private async getConnection(): Promise<jsforce.Connection> {
    if (this.connection) {
      return this.connection;
    }
    return this.refreshConnection();
  }

  private async refreshConnection(): Promise<jsforce.Connection> {
    const authResult = await this.authStrategy.authenticate();
    this.connection = new jsforce.Connection({
      instanceUrl: authResult.instanceUrl,
      accessToken: authResult.accessToken,
      version: env.SF_API_VERSION
    });
    return this.connection;
  }

  private isSessionExpiredError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const message = (error as { message?: string }).message ?? '';
    const errorCode = (error as { errorCode?: string }).errorCode ?? '';
    return message.includes('Session expired') || errorCode === 'INVALID_SESSION_ID';
  }

  private async executeWithRetry<T>(operation: (connection: jsforce.Connection) => Promise<T>): Promise<T> {
    const connection = await this.getConnection();
    try {
      return await operation(connection);
    } catch (firstError) {
      if (!this.isSessionExpiredError(firstError)) {
        this.translateAndThrow(firstError);
      }

      // Refresh connection for this environment and retry once
      try {
        const refreshedConnection = await this.refreshConnection();
        return await operation(refreshedConnection);
      } catch (retryError) {
        this.translateAndThrow(retryError);
      }
    }
  }

  private translateAndThrow(error: unknown): never {
    if (error instanceof ConnectionError || error instanceof ValidationError || error instanceof SalesforceError) {
      throw error;
    }
    const rawMessage = error instanceof Error ? error.message : 'Unknown Salesforce operation failure';
    // Use first line only, trimmed to at most 200 characters, avoiding raw payloads
    const cleanMessage = rawMessage.split('\n')[0]?.slice(0, 200).trim() || 'Salesforce operation failure';
    const errorCode = error && typeof error === 'object' ? (error as { errorCode?: string }).errorCode : undefined;
    throw new SalesforceError(cleanMessage, errorCode);
  }

  public async query<T extends jsforce.Record = jsforce.Record>(soql: string): Promise<T[]> {
    if (!soql || soql.trim() === '') {
      throw new ValidationError('SOQL query string cannot be empty');
    }
    return this.executeWithRetry(async (conn) => {
      const result = await conn.query<T>(soql);
      return result.records;
    });
  }

  public async getRecord<T>(sobjectName: string, recordId: string, fields?: string[]): Promise<T> {
    validateIdentifier(sobjectName, 'SObject name');
    validateRecordId(recordId);

    if (fields && fields.length > 0) {
      for (const field of fields) {
        validateIdentifier(field, 'Field name');
      }
    }

    return this.executeWithRetry(async (conn) => {
      const result = await conn.sobject(sobjectName).retrieve(recordId, fields ? { fields } : undefined);
      return result as T;
    });
  }

  public async describeObject(sobjectName: string): Promise<unknown> {
    validateIdentifier(sobjectName, 'SObject name');
    return this.executeWithRetry(async (conn) => {
      return conn.sobject(sobjectName).describe();
    });
  }

  public async createRecord(sobjectName: string, recordData: Record<string, unknown>): Promise<{ Id: string }> {
    if (!this.allowWrites) {
      throw new ValidationError('Writes are blocked for this environment', 'WRITES_BLOCKED');
    }
    validateIdentifier(sobjectName, 'SObject name');

    return this.executeWithRetry(async (conn) => {
      const result = await conn.sobject(sobjectName).create(recordData);
      if (Array.isArray(result)) {
        throw new SalesforceError('Unexpected batch create response from Salesforce');
      }
      if (!result.success) {
        const errorMsg = result.errors && result.errors.length > 0 ? result.errors[0] : 'Record creation failed';
        throw new SalesforceError(String(errorMsg));
      }
      return { Id: result.id };
    });
  }

  public async updateRecord(sobjectName: string, recordId: string, recordData: Record<string, unknown>): Promise<void> {
    if (!this.allowWrites) {
      throw new ValidationError('Writes are blocked for this environment', 'WRITES_BLOCKED');
    }
    validateIdentifier(sobjectName, 'SObject name');
    validateRecordId(recordId);

    return this.executeWithRetry(async (conn) => {
      const result = await conn.sobject(sobjectName).update({ Id: recordId, ...recordData });
      if (Array.isArray(result)) {
        throw new SalesforceError('Unexpected batch update response from Salesforce');
      }
      if (!result.success) {
        const errorMsg = result.errors && result.errors.length > 0 ? result.errors[0] : 'Record update failed';
        throw new SalesforceError(String(errorMsg));
      }
    });
  }

  public async deleteRecord(sobjectName: string, recordId: string): Promise<void> {
    if (!this.allowWrites) {
      throw new ValidationError('Writes are blocked for this environment', 'WRITES_BLOCKED');
    }
    validateIdentifier(sobjectName, 'SObject name');
    validateRecordId(recordId);

    return this.executeWithRetry(async (conn) => {
      const result = await conn.sobject(sobjectName).destroy(recordId);
      if (Array.isArray(result)) {
        throw new SalesforceError('Unexpected batch delete response from Salesforce');
      }
      if (!result.success) {
        const errorMsg = result.errors && result.errors.length > 0 ? result.errors[0] : 'Record deletion failed';
        throw new SalesforceError(String(errorMsg));
      }
    });
  }
}
