// Tracks records created during workflow execution so they can be cleaned up later.
// Stores real Salesforce IDs returned from createRecord calls in creation order.

export interface CreatedRecord {
  sobjectName: string;
  recordId: string;
}

export class CreatedRecordTracker {
  private readonly records: CreatedRecord[] = [];

  public add(sobjectName: string, recordId: string): void {
    if (!sobjectName || !recordId) {
      return;
    }
    this.records.push({ sobjectName, recordId });
  }

  public getAll(): ReadonlyArray<CreatedRecord> {
    return this.records;
  }
}
