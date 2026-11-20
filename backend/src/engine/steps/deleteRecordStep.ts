// Handles the execution of a deleteRecord node.
// Calls SalesforcePort to delete a record by its identifier and returns deletion confirmation.

import type { SalesforcePort } from '../salesforcePort.js';
import type { DeleteRecordSettings } from '../nodeSettings.js';

export async function executeDeleteRecord(
  settings: DeleteRecordSettings,
  port: SalesforcePort
): Promise<{ Id: string; deleted: boolean }> {
  await port.deleteRecord(settings.sobjectName, settings.recordId);
  return {
    Id: settings.recordId,
    deleted: true
  };
}
