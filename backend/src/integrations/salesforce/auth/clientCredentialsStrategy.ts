// Implements the OAuth 2.0 client credentials flow to get a Salesforce token.
// Exchanges client id and client secret directly against the Salesforce token endpoint.

import type { AuthResult, AuthStrategy } from './authStrategy.js';
import { ConnectionError, ValidationError } from '../../../utils/errors.js';

export interface ClientCredentialsConfig {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
}

export class ClientCredentialsStrategy implements AuthStrategy {
  private readonly loginUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: ClientCredentialsConfig) {
    if (!config.loginUrl || config.loginUrl.trim() === '') {
      throw new ValidationError('loginUrl is required');
    }
    if (!config.clientId || config.clientId.trim() === '') {
      throw new ValidationError('clientId is required');
    }
    if (!config.clientSecret || config.clientSecret.trim() === '') {
      throw new ValidationError('clientSecret is required');
    }

    const trimmedLoginUrl = config.loginUrl.trim();
    if (!trimmedLoginUrl.startsWith('https://')) {
      throw new ValidationError('loginUrl must start with https://');
    }

    // Remove any trailing slashes from the login URL
    this.loginUrl = trimmedLoginUrl.replace(/\/+$/, '');
    this.clientId = config.clientId.trim();
    this.clientSecret = config.clientSecret.trim();
  }

  public async authenticate(): Promise<AuthResult> {
    const tokenEndpoint = `${this.loginUrl}/services/oauth2/token`;
    const requestBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    let response: globalThis.Response;
    try {
      response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: requestBody.toString()
      });
    } catch {
      throw new ConnectionError('Failed to reach Salesforce token endpoint');
    }

    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        throw new ConnectionError('Salesforce authentication failed: invalid credentials');
      }
      throw new ConnectionError(`Salesforce token endpoint returned error status ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ConnectionError('Invalid JSON received from Salesforce token endpoint');
    }

    if (!payload || typeof payload !== 'object') {
      throw new ConnectionError('Invalid response shape from Salesforce token endpoint');
    }

    const tokenData = payload as { access_token?: unknown; instance_url?: unknown };
    if (typeof tokenData.access_token !== 'string' || typeof tokenData.instance_url !== 'string') {
      throw new ConnectionError('Missing access_token or instance_url in Salesforce response');
    }

    return {
      accessToken: tokenData.access_token,
      instanceUrl: tokenData.instance_url
    };
  }
}
