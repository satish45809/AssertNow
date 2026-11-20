// Handles the execution of a createRecord node.
// Calls the SalesforcePort to create the record and returns the new record Id and fields.

import type { SalesforcePort } from '../salesforcePort.js';
import type { CreateRecordSettings } from '../nodeSettings.js';

export async function executeCreateRecord(
  settings: CreateRecordSettings,
  port: SalesforcePort
): Promise<{ Id: string } & Record<string, unknown>> {
  const result = await port.createRecord(settings.sobjectName, settings.fields as Record<string, unknown>);
  return {
    Id: result.Id,
    ...settings.fields
  };
}
