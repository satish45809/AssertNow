// Defines the regular expressions and helper functions for template variable references.
// Central source of truth for detecting {{nodeId.fieldName}} expressions across the engine.

export const VARIABLE_REFERENCE_REGEX = /\{\{([A-Za-z0-9_-]+)\.([A-Za-z0-9_.]+)\}\}/;
export const EXACT_VARIABLE_REFERENCE_REGEX = /^\{\{[A-Za-z0-9_-]+\.[A-Za-z0-9_.]+\}\}$/;

export interface VariableReference {
  nodeId: string;
  fieldPath: string;
}

export function extractVariableReferences(text: string): VariableReference[] {
  const globalRegex = new RegExp(VARIABLE_REFERENCE_REGEX.source, 'g');
  const matches = text.matchAll(globalRegex);
  const references: VariableReference[] = [];

  for (const match of matches) {
    const nodeId = match[1];
    const fieldPath = match[2];
    if (nodeId && fieldPath) {
      references.push({ nodeId, fieldPath });
    }
  }

  return references;
}
