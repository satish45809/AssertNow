// Resolves template variable references like {{nodeId.fieldName}} using previous step outputs.
// Preserves real data types for exact references and performs string replacement for embedded references.

import { EXACT_VARIABLE_REFERENCE_REGEX, extractVariableReferences } from './references.js';
import { SystemError } from '../utils/errors.js';

function extractPathValue(output: unknown, fieldPath: string, referenceString: string): unknown {
  if (output === null || output === undefined || typeof output !== 'object') {
    throw new SystemError(`Reference '${referenceString}' could not be resolved: step has no output`);
  }

  const parts = fieldPath.split('.');
  let current: unknown = output;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      throw new SystemError(`Reference '${referenceString}' could not be resolved: field '${part}' not found`);
    }
    const record = current as Record<string, unknown>;
    if (!(part in record)) {
      throw new SystemError(`Reference '${referenceString}' could not be resolved: field '${part}' not found`);
    }
    current = record[part];
  }

  return current;
}

export function resolveValue(value: unknown, outputsByNodeId: Map<string, unknown>): unknown {
  if (typeof value === 'string') {
    // If the value is strictly an exact reference, return the resolved value preserving its original type
    if (EXACT_VARIABLE_REFERENCE_REGEX.test(value)) {
      const references = extractVariableReferences(value);
      const firstRef = references[0];
      if (!firstRef) {
        throw new SystemError(`Reference '${value}' could not be parsed`);
      }
      if (!outputsByNodeId.has(firstRef.nodeId)) {
        throw new SystemError(`Reference '${value}' could not be resolved: node '${firstRef.nodeId}' has no output`);
      }
      const nodeOutput = outputsByNodeId.get(firstRef.nodeId);
      return extractPathValue(nodeOutput, firstRef.fieldPath, value);
    }

    // If the value contains embedded references, replace each within the text string
    const references = extractVariableReferences(value);
    if (references.length === 0) {
      return value;
    }

    let result = value;
    for (const ref of references) {
      const placeholder = `{{${ref.nodeId}.${ref.fieldPath}}}`;
      if (!outputsByNodeId.has(ref.nodeId)) {
        throw new SystemError(`Reference '${placeholder}' could not be resolved: node '${ref.nodeId}' has no output`);
      }
      const nodeOutput = outputsByNodeId.get(ref.nodeId);
      const resolved = extractPathValue(nodeOutput, ref.fieldPath, placeholder);
      result = result.replaceAll(placeholder, String(resolved ?? ''));
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, outputsByNodeId));
  }

  if (value && typeof value === 'object') {
    const resolvedObject: Record<string, unknown> = {};
    for (const [key, propValue] of Object.entries(value)) {
      resolvedObject[key] = resolveValue(propValue, outputsByNodeId);
    }
    return resolvedObject;
  }

  return value;
}
