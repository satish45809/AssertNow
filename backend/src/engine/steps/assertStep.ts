// Handles the execution of an assert node.
// Asserts that a condition holds true, throwing an AssertionFailedError if expectation fails.

import type { AssertSettings } from '../nodeSettings.js';
import { AssertionFailedError } from '../../utils/errors.js';

export function executeAssert(settings: AssertSettings): { passed: boolean } {
  const { leftOperand, operator, rightOperand, message } = settings;
  let matches = false;

  if (operator === 'equals') {
    matches = String(leftOperand) === String(rightOperand);
  } else if (operator === 'notEquals') {
    matches = String(leftOperand) !== String(rightOperand);
  } else if (operator === 'contains') {
    matches = String(leftOperand).includes(String(rightOperand));
  }

  if (!matches) {
    const defaultMessage = `Assertion failed: expected '${leftOperand}' to ${operator} '${rightOperand}'`;
    throw new AssertionFailedError(message || defaultMessage);
  }

  return { passed: true };
}
