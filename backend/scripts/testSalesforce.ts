// Manual script to verify Salesforce connectivity against a real sandbox org.
// Reads credentials from .env, fetches one Account, and never logs secret values.

import dotenv from 'dotenv';
import { ClientCredentialsStrategy } from '../src/integrations/salesforce/auth/clientCredentialsStrategy.js';
import { SalesforceAdapter } from '../src/integrations/salesforce/salesforceAdapter.js';
import { logger } from '../src/utils/logger.js';

dotenv.config();

async function run(): Promise<void> {
  const loginUrl = process.env['SF_TEST_LOGIN_URL'];
  const clientId = process.env['SF_TEST_CLIENT_ID'];
  const clientSecret = process.env['SF_TEST_CLIENT_SECRET'];

  if (!loginUrl || !clientId || !clientSecret) {
    logger.error('Missing SF_TEST_LOGIN_URL, SF_TEST_CLIENT_ID or SF_TEST_CLIENT_SECRET in .env');
    process.exit(1);
  }

  logger.info({ loginUrl }, 'Starting Salesforce client credentials test');

  const strategy = new ClientCredentialsStrategy({
    loginUrl,
    clientId,
    clientSecret
  });

  const adapter = new SalesforceAdapter({
    environmentId: 'manual-test-environment',
    authStrategy: strategy,
    allowWrites: false
  });

  try {
    const accounts = await adapter.query<{ Id: string; Name: string }>('SELECT Id, Name FROM Account LIMIT 1');
    logger.info({ accountCount: accounts.length, sampleAccount: accounts[0] }, 'Successfully queried Salesforce Account');
  } catch (error) {
    logger.error({ err: error }, 'Failed to query Salesforce Account');
    process.exit(1);
  }
}

void run();
