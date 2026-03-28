import { GSValue, compare, equals, isTruthy } from './values';

/**
 * Pure operation helpers extracted from Evaluator to keep the class focused on
 * orchestration and scope management.
 */
export function evaluateBinaryOp(left: GSValue, right: GSValue, op: string): GSValue {
  switch (op) {
    case '+':
      return (left as number) + (right as number);
    case '-':
      return (left as number) - (right as number);
    case '*':
      return (left as number) * (right as number);
    case '/':
      return (left as number) / (right as number);
    case '%':
      return (left as number) % (right as number);
    case '^':
      return Math.pow(left as number, right as number);
    case '==':
      return equals(left, right);
    case '!=':
      return !equals(left, right);
    case '<':
      return compare(left, right, '<');
    case '>':
      return compare(left, right, '>');
    case '<=':
      return compare(left, right, '<=');
    case '>=':
      return compare(left, right, '>=');
    case 'and':
      return isTruthy(left) && isTruthy(right);
    case 'or':
      return isTruthy(left) || isTruthy(right);
    default:
      return null;
  }
}

export function evaluateUnaryOp(operand: GSValue, op: string): GSValue {
  switch (op) {
    case '-':
      return -(operand as number);
    case 'not':
      return !isTruthy(operand);
    default:
      return null;
  }
}

export function evaluateMemberAccess(obj: GSValue, property: string | number): GSValue {
  if (typeof obj === 'object' && obj !== null) {
    if (property in (obj as Record<string, GSValue>)) {
      return (obj as Record<string, GSValue>)[property as string];
    }
    if (Array.isArray(obj) && typeof property === 'number') {
      return obj[property];
    }
  }
  return null;
}
