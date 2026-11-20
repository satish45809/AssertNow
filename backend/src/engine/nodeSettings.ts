// Zod schemas defining and validating the configuration settings for each node type.
// Infers TypeScript types directly from schemas with strict key checking.

import { z } from 'zod';
import { EXACT_VARIABLE_REFERENCE_REGEX } from './references.js';
import {
  MIN_POLL_TIMEOUT_MILLISECONDS,
  MAX_POLL_TIMEOUT_MILLISECONDS,
  MIN_POLL_INTERVAL_MILLISECONDS,
  MAX_POLL_INTERVAL_MILLISECONDS
} from './limits.js';

// This only checks the SHAPE of a name. Whether the field exists or can be written is checked later with org metadata (Phase 4).
export const API_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]*$/;
const RECORD_ID_REGEX = /^[A-Za-z0-9]{15}$|^[A-Za-z0-9]{18}$/;

export function isValidApiName(name: string): boolean {
  return name.length > 0 && name.length <= 80 && API_NAME_REGEX.test(name);
}

export function isValidRelatedFieldName(name: string): boolean {
  if (name.length === 0 || name.length > 80) {
    return false;
  }
  const parts = name.split('.');
  for (const part of parts) {
    if (!API_NAME_REGEX.test(part)) {
      return false;
    }
  }
  return true;
}

const apiNameSchema = z.string().refine(isValidApiName, {
  message: 'Must be a valid API name (letters, digits, underscores, starting with letter, max 80 chars)'
});

const relatedFieldSchema = z.string().refine(isValidRelatedFieldName, {
  message: 'Must be a valid field name or dot-separated relationship path'
});

const recordIdOrReferenceSchema = z.string().refine(
  (value) => RECORD_ID_REGEX.test(value) || EXACT_VARIABLE_REFERENCE_REGEX.test(value),
  { message: 'Must be a 15/18 character Salesforce ID or a {{nodeId.fieldName}} reference' }
);

const fieldsMapSchema = z.record(apiNameSchema, z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const startNodeSettingsSchema = z.object({}).strict();

export const createRecordSettingsSchema = z.object({
  sobjectName: apiNameSchema,
  fields: fieldsMapSchema
}).strict();

const waitUntilConditionSchema = z.object({
  field: relatedFieldSchema,
  operator: z.enum(['equals', 'notEquals', 'contains']),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()])
}).strict();

export const getRecordSettingsSchema = z.object({
  sobjectName: apiNameSchema,
  recordId: recordIdOrReferenceSchema,
  fields: z.array(relatedFieldSchema).optional(),
  waitUntil: waitUntilConditionSchema.optional(),
  waitForMilliseconds: z.number().int().min(MIN_POLL_TIMEOUT_MILLISECONDS).max(MAX_POLL_TIMEOUT_MILLISECONDS).optional(),
  pollIntervalMilliseconds: z.number().int().min(MIN_POLL_INTERVAL_MILLISECONDS).max(MAX_POLL_INTERVAL_MILLISECONDS).optional()
}).strict();

export const updateRecordSettingsSchema = z.object({
  sobjectName: apiNameSchema,
  recordId: recordIdOrReferenceSchema,
  fields: fieldsMapSchema
}).strict();

export const deleteRecordSettingsSchema = z.object({
  sobjectName: apiNameSchema,
  recordId: recordIdOrReferenceSchema
}).strict();

const comparisonOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'contains',
  'greaterThan',
  'lessThan'
]);

export const decisionSettingsSchema = z.object({
  leftOperand: z.string(),
  operator: comparisonOperatorSchema,
  rightOperand: z.string()
}).strict();

const assertOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'contains'
]);

export const assertSettingsSchema = z.object({
  leftOperand: z.string(),
  operator: assertOperatorSchema,
  rightOperand: z.string(),
  message: z.string().optional()
}).strict();

export type StartNodeSettings = z.infer<typeof startNodeSettingsSchema>;
export type CreateRecordSettings = z.infer<typeof createRecordSettingsSchema>;
export type GetRecordSettings = z.infer<typeof getRecordSettingsSchema>;
export type UpdateRecordSettings = z.infer<typeof updateRecordSettingsSchema>;
export type DeleteRecordSettings = z.infer<typeof deleteRecordSettingsSchema>;
export type DecisionSettings = z.infer<typeof decisionSettingsSchema>;
export type AssertSettings = z.infer<typeof assertSettingsSchema>;
