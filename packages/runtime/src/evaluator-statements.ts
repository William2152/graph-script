import { Statement } from '@graphscript/ast';
import { GSAlgorithm, GSValue, isTruthy } from './values';

interface StatementOps {
  evalExpression(expr: any): GSValue;
  evalStatement(stmt: Statement): GSValue;
  findCurrentAlgorithm(): GSAlgorithm | null;
}

function shouldPropagateControl(stmt: Statement): boolean {
  return (
    stmt.type === 'ReturnStatement' ||
    stmt.type === 'BreakStatement' ||
    stmt.type === 'ContinueStatement'
  );
}

/**
 * Statement execution helper extracted from Evaluator.
 */
export function evaluateStatementNode(
  stmt: Statement,
  ops: StatementOps,
  scopeValues: Record<string, GSValue>,
): GSValue {
  switch (stmt.type) {
    case 'ExpressionStatement':
      return ops.evalExpression(stmt.expression);
    case 'AssignmentStatement':
      scopeValues[stmt.target] = ops.evalExpression(stmt.value);
      return null;
    case 'IfStatement':
      if (isTruthy(ops.evalExpression(stmt.condition))) {
        for (const branchStatement of stmt.thenBranch) {
          const result = ops.evalStatement(branchStatement);
          if (result !== null && shouldPropagateControl(branchStatement)) {
            return result;
          }
        }
      } else if (stmt.elseIfBranches) {
        for (const elseIfBranch of stmt.elseIfBranches) {
          if (!isTruthy(ops.evalExpression(elseIfBranch.condition))) {
            continue;
          }
          for (const branchStatement of elseIfBranch.body) {
            const result = ops.evalStatement(branchStatement);
            if (result !== null && shouldPropagateControl(branchStatement)) {
              return result;
            }
          }
          break;
        }
      } else if (stmt.elseBranch) {
        for (const branchStatement of stmt.elseBranch) {
          const result = ops.evalStatement(branchStatement);
          if (result !== null && shouldPropagateControl(branchStatement)) {
            return result;
          }
        }
      }
      return null;
    case 'WhileStatement':
      while (isTruthy(ops.evalExpression(stmt.condition))) {
        for (const bodyStatement of stmt.body) {
          const result = ops.evalStatement(bodyStatement);
          if (bodyStatement.type === 'BreakStatement') return null;
          if (bodyStatement.type === 'ContinueStatement') break;
          if (result !== null && bodyStatement.type === 'ReturnStatement') return result;
        }
      }
      return null;
    case 'ForStatement': {
      const iterable = ops.evalExpression(stmt.iterable);
      if (Array.isArray(iterable)) {
        for (const item of iterable) {
          scopeValues[stmt.variable] = item;
          for (const bodyStatement of stmt.body) {
            const result = ops.evalStatement(bodyStatement);
            if (bodyStatement.type === 'BreakStatement') return null;
            if (bodyStatement.type === 'ContinueStatement') break;
            if (result !== null && bodyStatement.type === 'ReturnStatement') return result;
          }
        }
      }
      return null;
    }
    case 'ReturnStatement':
      return stmt.value ? ops.evalExpression(stmt.value) : null;
    case 'BreakStatement':
      return { type: 'break' };
    case 'ContinueStatement':
      return { type: 'continue' };
    case 'EmitStatement': {
      const algorithm = ops.findCurrentAlgorithm();
      if (algorithm) {
        const row: Record<string, GSValue> = {};
        for (const field of stmt.fields) {
          row[field.name] = ops.evalExpression(field.value);
        }
        if (algorithm.trace.columns.length === 0) {
          algorithm.trace.columns = stmt.fields.map((field) => field.name);
        }
        algorithm.trace.rows.push(row);
      }
      return null;
    }
    default:
      return null;
  }
}
