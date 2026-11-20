// Tests the SalesforceAdapter with a simulated connection and auth strategies.
// Verifies read operations, write block enforcement, error translation, and retry logic.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Connection, Record as SfRecord } from 'jsforce';
import { SalesforceAdapter } from './salesforceAdapter.js';
import type { AuthStrategy } from './auth/authStrategy.js';
import { ValidationError, SalesforceError } from '../../utils/errors.js';
import { escapeSoqlString, validateIdentifier, validateRecordId } from './soqlHelper.js';
import { CreatedRecordTracker } from '../../engine/createdRecords.js';
import { runTeardown } from '../../engine/runTeardown.js';

interface FakeSObjectHandler {
  retrieve: (id: string, options?: { fields?: string[] }) => Promise<SfRecord>;
  describe: () => Promise<unknown>;
  create: (data: Record<string, unknown>) => Promise<{ id: string; success: boolean; errors?: string[] }>;
  update: (data: Record<string, unknown>) => Promise<{ id: string; success: boolean; errors?: string[] }>;
  destroy: (id: string) => Promise<{ id: string; success: boolean; errors?: string[] }>;
}

interface FakeConnection {
  query: (soql: string) => Promise<{ records: SfRecord[]; totalSize: number; done: boolean }>;
  sobject: (name: string) => FakeSObjectHandler;
}

interface TestAccount extends SfRecord {
  Id: string;
  Name: string;
}

describe('SalesforceAdapter', () => {
  let fakeAuthStrategy: AuthStrategy;
  let fakeConnection: FakeConnection;
  let fakeSObject: FakeSObjectHandler;

  beforeEach(() => {
    vi.restoreAllMocks();

    fakeAuthStrategy = {
      authenticate: vi.fn().mockResolvedValue({
        accessToken: 'mock_token',
        instanceUrl: 'https://mock.salesforce.com'
      })
    };

    fakeSObject = {
      retrieve: vi.fn(),
      describe: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn()
    };

    fakeConnection = {
      query: vi.fn(),
      sobject: vi.fn().mockReturnValue(fakeSObject)
    };
  });

  function createTestAdapter(allowWrites = false): SalesforceAdapter {
    const adapter = new SalesforceAdapter({
      environmentId: 'env-1',
      authStrategy: fakeAuthStrategy,
      allowWrites
    });

    // We inject fakeConnection into private connection property to avoid real network calls
    const privateAdapter = adapter as unknown as { connection: Connection };
    privateAdapter.connection = fakeConnection as unknown as Connection;

    return adapter;
  }

  describe('SOQL Helper', () => {
    it('validates safe identifiers and rejects injection attempts', () => {
      expect(() => validateIdentifier('Account')).not.toThrow();
      expect(() => validateIdentifier('Custom_Field__c')).not.toThrow();
      expect(() => validateIdentifier('Account; DROP TABLE Users--')).toThrow(ValidationError);
      expect(() => validateIdentifier('123Invalid')).toThrow(ValidationError);
    });

    it('validates record IDs of 15 and 18 characters', () => {
      expect(() => validateRecordId('001xx000003DHP0AAO')).not.toThrow();
      expect(() => validateRecordId('001xx000003DHP0')).not.toThrow();
      expect(() => validateRecordId('shortId')).toThrow(ValidationError);
      expect(() => validateRecordId('invalid_special!@#')).toThrow(ValidationError);
    });

    it('escapes special characters including quotes, slashes, newlines, tabs', () => {
      const unescaped = "O'Reilly \\ \"Quote\"\nLine2\rLine3\tTab";
      const escaped = escapeSoqlString(unescaped);
      expect(escaped).toBe("O\\'Reilly \\\\ \\\"Quote\\\"\\nLine2\\rLine3\\tTab");
    });
  });

  describe('Read operations', () => {
    it('executes query and returns record list', async () => {
      const mockRecords: TestAccount[] = [{ Id: '001xx000003DHP0AAO', Name: 'Acme Corp' }];
      vi.spyOn(fakeConnection, 'query').mockResolvedValue({
        records: mockRecords,
        totalSize: 1,
        done: true
      });

      const adapter = createTestAdapter();
      const records = await adapter.query<TestAccount>('SELECT Id, Name FROM Account');
      expect(records).toEqual(mockRecords);
    });

    it('retrieves single record with getRecord', async () => {
      const mockRecord: TestAccount = { Id: '001xx000003DHP0AAO', Name: 'Test' };
      vi.spyOn(fakeSObject, 'retrieve').mockResolvedValue(mockRecord);

      const adapter = createTestAdapter();
      const record = await adapter.getRecord<TestAccount>('Account', '001xx000003DHP0AAO', ['Name']);
      expect(record).toEqual(mockRecord);
      expect(fakeSObject.retrieve).toHaveBeenCalledWith('001xx000003DHP0AAO', { fields: ['Name'] });
    });

    it('describes an object with describeObject', async () => {
      const mockDescribe = { name: 'Account', custom: false };
      vi.spyOn(fakeSObject, 'describe').mockResolvedValue(mockDescribe);

      const adapter = createTestAdapter();
      const describeResult = await adapter.describeObject('Account');
      expect(describeResult).toEqual(mockDescribe);
      expect(fakeSObject.describe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Write protection guardrails', () => {
    it('blocks createRecord when allowWrites is false with WRITES_BLOCKED code', async () => {
      const adapter = createTestAdapter(false);

      let caughtError: unknown;
      try {
        await adapter.createRecord('Account', { Name: 'New' });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ValidationError);
      const valError = caughtError as ValidationError;
      expect(valError.message).toBe('Writes are blocked for this environment');
      expect(valError.code).toBe('WRITES_BLOCKED');
    });

    it('blocks updateRecord when allowWrites is false with WRITES_BLOCKED code', async () => {
      const adapter = createTestAdapter(false);

      let caughtError: unknown;
      try {
        await adapter.updateRecord('Account', '001xx000003DHP0AAO', { Name: 'Updated' });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ValidationError);
      const valError = caughtError as ValidationError;
      expect(valError.message).toBe('Writes are blocked for this environment');
      expect(valError.code).toBe('WRITES_BLOCKED');
    });

    it('blocks deleteRecord when allowWrites is false with WRITES_BLOCKED code', async () => {
      const adapter = createTestAdapter(false);

      let caughtError: unknown;
      try {
        await adapter.deleteRecord('Account', '001xx000003DHP0AAO');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ValidationError);
      const valError = caughtError as ValidationError;
      expect(valError.message).toBe('Writes are blocked for this environment');
      expect(valError.code).toBe('WRITES_BLOCKED');
    });

    it('allows write operations when allowWrites is true and returns Id capitalized', async () => {
      vi.spyOn(fakeSObject, 'create').mockResolvedValue({ id: '001xx000003DHP0AAO', success: true });
      vi.spyOn(fakeSObject, 'update').mockResolvedValue({ id: '001xx000003DHP0AAO', success: true });
      vi.spyOn(fakeSObject, 'destroy').mockResolvedValue({ id: '001xx000003DHP0AAO', success: true });

      const adapter = createTestAdapter(true);

      const createResult = await adapter.createRecord('Account', { Name: 'Acme' });
      expect(createResult.Id).toBe('001xx000003DHP0AAO');

      await expect(adapter.updateRecord('Account', '001xx000003DHP0AAO', { Name: 'Acme 2' })).resolves.toBeUndefined();
      await expect(adapter.deleteRecord('Account', '001xx000003DHP0AAO')).resolves.toBeUndefined();
    });

    it('maps real adapter blocked deleteRecord through runTeardown to reason writesBlocked', async () => {
      const adapter = createTestAdapter(false);
      const tracker = new CreatedRecordTracker();
      tracker.add('Account', '001xx000003DHP0AAO');

      const results = await runTeardown(tracker, adapter);
      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('failed');
      expect(results[0]!.reason).toBe('writesBlocked');
      expect(results[0]!.error).toBe('Writes are blocked for this environment');
    });
  });

  describe('Session expiration retry and error translation', () => {
    it('retries once when Salesforce session expires and succeeds', async () => {
      let callCount = 0;
      vi.spyOn(fakeConnection, 'query').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const expiredError = new Error('Session expired or invalid');
          (expiredError as unknown as { errorCode: string }).errorCode = 'INVALID_SESSION_ID';
          throw expiredError;
        }
        return { records: [{ Id: '001xx000003DHP0AAO' }], totalSize: 1, done: true };
      });

      const adapter = createTestAdapter();
      vi.spyOn(adapter as unknown as { refreshConnection: () => Promise<Connection> }, 'refreshConnection')
        .mockResolvedValue(fakeConnection as unknown as Connection);

      const records = await adapter.query('SELECT Id FROM Account');
      expect(records).toHaveLength(1);
      expect(callCount).toBe(2);
    });

    it('translates generic Salesforce errors, keeps errorCode, and strips raw payload', async () => {
      const sfError = new Error('FIELD_CUSTOM_VALIDATION_EXCEPTION: Bad value\nRaw Payload: { "details": "secret" }\nStack Trace: ...');
      (sfError as unknown as { errorCode: string }).errorCode = 'FIELD_CUSTOM_VALIDATION_EXCEPTION';
      vi.spyOn(fakeConnection, 'query').mockRejectedValue(sfError);

      const adapter = createTestAdapter();

      let caughtError: unknown;
      try {
        await adapter.query('SELECT BadField FROM Account');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(SalesforceError);
      const castError = caughtError as SalesforceError;
      expect(castError.message).toBe('FIELD_CUSTOM_VALIDATION_EXCEPTION: Bad value');
      expect(castError.message).not.toContain('Raw Payload');
      expect(castError.errorCode).toBe('FIELD_CUSTOM_VALIDATION_EXCEPTION');
    });
  });
});
