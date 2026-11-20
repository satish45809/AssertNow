// Defines the Salesforce operations interface required by the workflow engine.
// Decouples the engine from specific adapter implementations and prevents direct jsforce imports.

export interface SalesforcePort {
  createRecord(sobjectName: string, recordData: Record<string, unknown>): Promise<{ Id: string }>;
  getRecord(sobjectName: string, recordId: string, fields?: string[]): Promise<Record<string, unknown>>;
  updateRecord(sobjectName: string, recordId: string, recordData: Record<string, unknown>): Promise<void>;
  deleteRecord(sobjectName: string, recordId: string): Promise<void>;
}
