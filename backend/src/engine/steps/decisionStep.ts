// Handles the execution of a decision node.
// Compares operands with operators like equals, contains, or numeric comparisons to pick true or false.

import type { DecisionSettings } from '../nodeSettings.js';
import { ValidationError } from '../../utils/errors.js';

export function executeDecision(
  settings: DecisionSettings
): { branch: 'true' | 'false'; result: boolean } {
  const { leftOperand, operator, rightOperand } = settings;
  let matches = false;

  if (operator === 'equals') {
    matches = String(leftOperand) === String(rightOperand);
  } else if (operator === 'notEquals') {
    matches = String(leftOperand) !== String(rightOperand);
  } else if (operator === 'contains') {
    matches = String(leftOperand).includes(String(rightOperand));
  } else if (operator === 'greaterThan' || operator === 'lessThan') {
    const leftNumber = Number(leftOperand);
    const rightNumber = Number(rightOperand);

    if (isNaN(leftNumber) || isNaN(rightNumber)) {
      throw new ValidationError(`Comparison '${operator}' requires numeric values, received '${leftOperand}' and '${rightOperand}'`);
    }

    matches = operator === 'greaterThan' ? leftNumber > rightNumber : leftNumber < rightNumber;
  }

  return {
    branch: matches ? 'true' : 'false',
    result: matches
  };
}
