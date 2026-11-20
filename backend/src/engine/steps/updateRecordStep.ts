// Handles the execution of an updateRecord node.
// Sends record field updates to SalesforcePort and returns the updated fields.

import type { SalesforcePort } from '../salesforcePort.js';
import type { UpdateRecordSettings } from '../nodeSettings.js';

export async function executeUpdateRecord(
  settings: UpdateRecordSettings,
  port: SalesforcePort
): Promise<{ Id: string } & Record<string, unknown>> {
  await port.updateRecord(settings.sobjectName, settings.recordId, settings.fields as Record<string, unknown>);
  return {
    Id: settings.recordId,
    ...settings.fields
  };
}
