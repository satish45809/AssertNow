/**
 * Salesforce Business & Integration Service
 * Handles credential lifecycle, encryption, schema introspection, and queries.
 */

import { SalesforceAdapter } from '../adapters/SalesforceAdapter.ts';
import { Environment, CreateEnvironmentDto, SalesforceCredentials } from '../models/Environment.ts';
import { NotFoundError, ValidationError } from '../models/Error.ts';
import { Encryption } from '../utils/Encryption.ts';

export class SalesforceService {
  // In-memory runtime store (zero hardcoded values, dynamic from frontend localStorage)
  private static environments: Environment[] = [];

  public static syncEnvironments(envs: Environment[]): void {
    this.environments = envs;
    SalesforceAdapter.clearConnectionCache();
  }

  public static async listEnvironments(): Promise<any[]> {
    return this.environments.map(env => ({
      ...env,
      environmentType: env.tier,
      connectionStatus: 'HEALTHY',
      status: env.status || 'ONLINE',
      instanceUrl: env.credentials.instanceUrl || env.credentials.loginUrl,
      apiHealth: env.status === 'ONLINE' ? 100 : 0,
      lastMetadataSyncAt: env.lastVerifiedAt ? new Date(env.lastVerifiedAt).toLocaleTimeString() : 'Recent',
      credentials: {
        ...env.credentials,
        clientSecret: env.credentials.clientSecret ? '••••••••' : undefined,
        refreshToken: env.credentials.refreshToken ? '••••••••' : undefined,
      },
    }));
  }

  public static async getEnvironmentById(id: string): Promise<Environment> {
    if ((!id || id === 'default') && this.environments.length > 0) {
      return this.environments[0];
    }
    const env = this.environments.find(e => e.id === id);
    if (!env) {
      if (this.environments.length > 0) {
        return this.environments[0];
      }
      throw new NotFoundError('Salesforce Environment', id);
    }
    return env;
  }

  public static async getDecryptedCredentials(id: string): Promise<SalesforceCredentials> {
    const env = await this.getEnvironmentById(id);
    return {
      loginUrl: env.credentials.loginUrl,
      clientId: env.credentials.clientId,
      clientSecret: env.credentials.clientSecret ? await Encryption.decrypt(env.credentials.clientSecret) : undefined,
      refreshToken: env.credentials.refreshToken ? await Encryption.decrypt(env.credentials.refreshToken) : undefined,
      accessToken: env.credentials.accessToken,
      instanceUrl: env.credentials.instanceUrl,
      username: env.credentials.username,
    };
  }

  public static async createEnvironment(dto: CreateEnvironmentDto): Promise<Environment> {
    if (!dto.name || !dto.credentials.clientId || !dto.credentials.loginUrl) {
      throw new ValidationError('Environment name, Client ID, and Login URL are required fields.');
    }

    // Encrypt secrets before persisting (preserving existing encrypted secrets on reconnect)
    const existingEnv = this.environments.find(e => e.name === dto.name || e.credentials.clientId === dto.credentials.clientId);
    
    let encryptedSecret = dto.credentials.clientSecret && !dto.credentials.clientSecret.includes('•') 
      ? await Encryption.encrypt(dto.credentials.clientSecret) 
      : undefined;

    let encryptedRefresh = dto.credentials.refreshToken && !dto.credentials.refreshToken.includes('•')
      ? await Encryption.encrypt(dto.credentials.refreshToken)
      : undefined;

    if (!encryptedSecret && existingEnv?.credentials.clientSecret) {
      encryptedSecret = existingEnv.credentials.clientSecret;
    }
    if (!encryptedRefresh && existingEnv?.credentials.refreshToken) {
      encryptedRefresh = existingEnv.credentials.refreshToken;
    }

    const encryptedCredentials: SalesforceCredentials = {
      ...dto.credentials,
      clientSecret: encryptedSecret,
      refreshToken: encryptedRefresh,
    };

    const newEnv: any = {
      id: `env-sf-${Date.now()}`,
      organizationId: 'org-enterprise-1',
      name: dto.name,
      platform: dto.platform,
      tier: dto.tier,
      environmentType: dto.tier,
      authMethod: dto.authMethod,
      status: 'ONLINE',
      connectionStatus: 'HEALTHY',
      apiHealth: 99.9,
      lastMetadataSyncAt: 'Just Now',
      instanceUrl: dto.credentials.instanceUrl || dto.credentials.loginUrl,
      credentials: encryptedCredentials,
      lastVerifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Replace existing environment if same name or clientId exists to prevent duplicates on reconnect
    const existingIndex = this.environments.findIndex(e => e.name === dto.name || e.credentials.clientId === dto.credentials.clientId);
    if (existingIndex >= 0) {
      newEnv.id = this.environments[existingIndex].id;
      this.environments[existingIndex] = newEnv;
    } else {
      this.environments.unshift(newEnv);
    }
    SalesforceAdapter.clearConnectionCache();
    return newEnv;
  }

  public static async deleteEnvironment(id: string): Promise<boolean> {
    const initialCount = this.environments.length;
    this.environments = this.environments.filter(e => e.id !== id);
    return this.environments.length < initialCount;
  }

  public static async updateEnvironment(id: string, updates: Partial<Environment>): Promise<Environment> {
    const env = await this.getEnvironmentById(id);
    if (updates.credentials) {
      if (updates.credentials.clientSecret) {
        updates.credentials.clientSecret = await Encryption.encrypt(updates.credentials.clientSecret);
      }
      if (updates.credentials.refreshToken) {
        updates.credentials.refreshToken = await Encryption.encrypt(updates.credentials.refreshToken);
      }
    }
    Object.assign(env, updates, { updatedAt: new Date().toISOString() });
    return env;
  }

  public static async testEnvironment(environmentId: string) {
    const creds = await this.getDecryptedCredentials(environmentId);
    try {
      const result = await SalesforceAdapter.testConnection(creds);
      const env = this.environments.find(e => e.id === environmentId);
      if (env) {
        env.status = 'ONLINE';
        (env as any).connectionStatus = 'HEALTHY';
        (env as any).lastVerifiedAt = new Date().toISOString();
      }
      return result;
    } catch (err: any) {
      const env = this.environments.find(e => e.id === environmentId);
      if (env) {
        env.status = 'ERROR';
        (env as any).connectionStatus = 'DEGRADED';
      }
      throw err;
    }
  }

  public static async verifyConnection(credentials: SalesforceCredentials) {
    return await SalesforceAdapter.testConnection(credentials);
  }

  public static async listSObjects(environmentId: string) {
    const creds = await this.getDecryptedCredentials(environmentId);
    return await SalesforceAdapter.describeGlobal(creds);
  }

  public static async describeSObject(environmentId: string, sobjectName: string) {
    const creds = await this.getDecryptedCredentials(environmentId);
    return await SalesforceAdapter.describeSObject(creds, sobjectName);
  }

  public static async executeQuery(environmentId: string, soql: string) {
    if (!soql || !soql.trim().toLowerCase().startsWith('select')) {
      throw new ValidationError('A valid SOQL SELECT statement is required.');
    }
    const creds = await this.getDecryptedCredentials(environmentId);
    return await SalesforceAdapter.query(creds, soql);
  }

  public static async createRecord(environmentId: string, sobjectName: string, fields: Record<string, unknown>) {
    const creds = await this.getDecryptedCredentials(environmentId);
    console.log('[DEBUG createRecord]', environmentId, sobjectName, {
      clientId: creds.clientId?.slice(0, 15),
      hasClientSecret: !!creds.clientSecret,
      clientSecretLen: creds.clientSecret?.length,
      hasRefreshToken: !!creds.refreshToken,
      refreshTokenLen: creds.refreshToken?.length,
      hasAccessToken: !!creds.accessToken,
      loginUrl: creds.loginUrl,
      instanceUrl: creds.instanceUrl,
    });
    return await SalesforceAdapter.createRecord(creds, sobjectName, fields);
  }

  public static async retrieveRecord(environmentId: string, sobjectName: string, id: string, fields?: string[]) {
    const creds = await this.getDecryptedCredentials(environmentId);
    return await SalesforceAdapter.retrieveRecord(creds, sobjectName, id, fields);
  }

  public static async updateRecord(environmentId: string, sobjectName: string, id: string, fields: Record<string, unknown>) {
    const creds = await this.getDecryptedCredentials(environmentId);
    return await SalesforceAdapter.updateRecord(creds, sobjectName, id, fields);
  }

  public static async deleteRecord(environmentId: string, sobjectName: string, id: string) {
    const creds = await this.getDecryptedCredentials(environmentId);
    return await SalesforceAdapter.deleteRecord(creds, sobjectName, id);
  }

  public static async exchangeAuthCode(params: {
    code: string;
    clientId: string;
    clientSecret?: string;
    codeVerifier?: string;
    instanceUrl?: string;
    loginUrl?: string;
    redirectUri: string;
  }) {
    if (!params.clientSecret || params.clientSecret.includes('•')) {
      const match = this.environments.find(e => e.credentials.clientId === params.clientId);
      if (match && match.credentials.clientSecret) {
        params.clientSecret = await Encryption.decrypt(match.credentials.clientSecret);
      }
    }
    return await SalesforceAdapter.exchangeAuthCode(params);
  }
}

