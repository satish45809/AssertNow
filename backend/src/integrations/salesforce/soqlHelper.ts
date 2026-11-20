// Validates Salesforce object and field names and escapes SOQL string literals.
// Prevents SOQL injection by disallowing invalid characters and escaping special symbols.

import { ValidationError } from '../../utils/errors.js';

const IDENTIFIER_REGEX = /^[A-Za-z][A-Za-z0-9_]*$/;
const RECORD_ID_REGEX = /^[A-Za-z0-9]{15}$|^[A-Za-z0-9]{18}$/;

export function validateIdentifier(name: string, description: string = 'Identifier'): void {
  if (!name || !IDENTIFIER_REGEX.test(name)) {
    throw new ValidationError(`Invalid ${description}: "${name}". Must match /^[A-Za-z][A-Za-z0-9_]*$/`);
  }
}

export function validateRecordId(recordId: string): void {
  if (!recordId || !RECORD_ID_REGEX.test(recordId)) {
    throw new ValidationError(`Invalid Salesforce record ID: "${recordId}". Must be 15 or 18 alphanumeric characters`);
  }
}

export function escapeSoqlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
