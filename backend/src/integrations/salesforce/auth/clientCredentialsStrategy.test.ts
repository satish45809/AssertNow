// Tests the client credentials authentication strategy with mock HTTP endpoints.
// Verifies URL validation, credential handling, HTTP error statuses, and payload decoding.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClientCredentialsStrategy } from './clientCredentialsStrategy.js';
import { ConnectionError, ValidationError } from '../../../utils/errors.js';

describe('ClientCredentialsStrategy', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws ValidationError when loginUrl is missing or invalid', () => {
    expect(() => new ClientCredentialsStrategy({
      loginUrl: '',
      clientId: 'valid_client_id',
      clientSecret: 'valid_client_secret'
    })).toThrow(ValidationError);

    expect(() => new ClientCredentialsStrategy({
      loginUrl: 'http://insecure.salesforce.com',
      clientId: 'valid_client_id',
      clientSecret: 'valid_client_secret'
    })).toThrow('loginUrl must start with https://');
  });

  it('throws ValidationError when clientId or clientSecret is missing', () => {
    expect(() => new ClientCredentialsStrategy({
      loginUrl: 'https://test.my.salesforce.com',
      clientId: '',
      clientSecret: 'valid_client_secret'
    })).toThrow('clientId is required');

    expect(() => new ClientCredentialsStrategy({
      loginUrl: 'https://test.my.salesforce.com',
      clientId: 'valid_client_id',
      clientSecret: ''
    })).toThrow('clientSecret is required');
  });

  it('authenticates successfully and strips trailing slash from loginUrl', async () => {
    const fakeResponse = {
      access_token: 'fake_access_token_123',
      instance_url: 'https://test.my.salesforce.com'
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fakeResponse
    } as unknown as Response);

    const strategy = new ClientCredentialsStrategy({
      loginUrl: 'https://test.my.salesforce.com///',
      clientId: 'client_id_abc',
      clientSecret: 'client_secret_xyz'
    });

    const result = await strategy.authenticate();
    expect(result.accessToken).toBe('fake_access_token_123');
    expect(result.instanceUrl).toBe('https://test.my.salesforce.com');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://test.my.salesforce.com/services/oauth2/token',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  it('maps HTTP 400 and 401 to ConnectionError with invalid credentials message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'authentication failure' })
    } as unknown as Response);

    const strategy = new ClientCredentialsStrategy({
      loginUrl: 'https://test.my.salesforce.com',
      clientId: 'bad_client',
      clientSecret: 'bad_secret'
    });

    await expect(strategy.authenticate()).rejects.toThrow(ConnectionError);
    await expect(strategy.authenticate()).rejects.toThrow('Salesforce authentication failed: invalid credentials');
  });

  it('maps network failure to ConnectionError without exposing credentials', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('DNS lookup failed'));

    const strategy = new ClientCredentialsStrategy({
      loginUrl: 'https://unreachable.my.salesforce.com',
      clientId: 'my_client_id',
      clientSecret: 'super_secret_value'
    });

    const errorPromise = strategy.authenticate();
    await expect(errorPromise).rejects.toThrow(ConnectionError);
    await expect(errorPromise).rejects.toThrow('Failed to reach Salesforce token endpoint');
  });
});
