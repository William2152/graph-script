import { AstNode, Expression, Program, Statement } from '@graphscript/ast';
import { GSAlgorithm, GSFunction, GSValue, Trace } from './values';
import { evaluateBinaryOp, evaluateMemberAccess, evaluateUnaryOp } from './evaluator-ops';
import { createBuiltinValues } from './evaluator-builtins';
import { executeTopLevelNode } from './evaluator-top-level';
import { evaluateStatementNode } from './evaluator-statements';

export interface RuntimeScope {
  parent?: RuntimeScope;
  values: Record<string, GSValue>;
}

/**
 * Runtime evaluator for GraphScript AST.
 * The class handles scope management and execution flow, while low-level
 * operators and builtins are delegated to focused helper modules.
 */
export class Evaluator {
  private scope: RuntimeScope;
  private algorithms: Record<string, GSAlgorithm> = {};
  private traces: Record<string, Trace> = {};

  constructor() {
    this.scope = this.createScope();
    this.initBuiltins();
  }

  private createScope(parent?: RuntimeScope): RuntimeScope {
    return { parent, values: {} };
  }

  private initBuiltins(): void {
    this.scope.values = createBuiltinValues();
  }

  execute(program: Program): Record<string, GSValue> {
    for (const node of program.body) {
      this.executeTopLevel(node);
    }
    return this.scope.values;
  }

  private executeTopLevel(node: AstNode): void {
    executeTopLevelNode(
      node,
      {
        evalExpression: (expr) => this.evalExpression(expr),
        createFunction: (params, body) => this.createFunction(params, body),
      },
      this.scope.values,
      this.algorithms,
      this.traces,
    );
  }

  private createFunction(params: string[], body: any[]): GSFunction {
    return { type: 'function', params, body, closure: { ...this.scope.values } };
  }

  private evalExpression(expr: Expression): GSValue {
    switch (expr.type) {
      case 'Literal':
        return expr.value;
      case 'Identifier': {
        const value = this.lookup(expr.name);
        if (value === undefined) {
          throw new Error(`Undefined: ${expr.name}`);
        }
        return value;
      }
      case 'BinaryExpression':
        return this.evalBinary(expr);
      case 'UnaryExpression':
        return this.evalUnary(expr);
      case 'CallExpression':
        return this.evalCall(expr);
      case 'MemberExpression':
        return this.evalMember(expr);
      case 'ArrayExpression':
        return expr.elements.map((element) => this.evalExpression(element));
      case 'ObjectExpression': {
        const obj: Record<string, GSValue> = {};
        for (const prop of expr.properties) {
          obj[prop.key] = this.evalExpression(prop.value);
        }
        return obj;
      }
      default:
        return null;
    }
  }

  private evalBinary(expr: any): GSValue {
    const left = this.evalExpression(expr.left);
    const right = this.evalExpression(expr.right);
    return evaluateBinaryOp(left, right, expr.operator);
  }

  private evalUnary(expr: any): GSValue {
    const operand = this.evalExpression(expr.operand);
    return evaluateUnaryOp(operand, expr.operator);
  }

  private evalCall(expr: any): GSValue {
    const fn = this.evalExpression(expr.callee);
    const args = expr.args.map((arg: Expression) => this.evalExpression(arg));

    if (fn && typeof fn === 'object' && (fn as GSFunction).type === 'function') {
      const fnValue = fn as GSFunction;
      const newScope = this.createScope();
      newScope.values = { ...fnValue.closure };
      for (let i = 0; i < fnValue.params.length; i++) {
        newScope.values[fnValue.params[i]] = args[i];
      }

      const oldScope = this.scope;
      this.scope = newScope;

      let result: GSValue = null;
      for (const stmt of fnValue.body) {
        result = this.evalStatement(stmt);
        if (stmt.type === 'ReturnStatement') {
          break;
        }
      }

      this.scope = oldScope;
      return result;
    }

    if (typeof fn === 'function') {
      return fn(...args);
    }

    throw new Error(`Cannot call ${typeof fn}`);
  }

  private evalMember(expr: any): GSValue {
    const obj = this.evalExpression(expr.object);
    return evaluateMemberAccess(obj, expr.property as string | number);
  }

  private evalStatement(stmt: Statement): GSValue {
    return evaluateStatementNode(
      stmt,
      {
        evalExpression: (expr) => this.evalExpression(expr),
        evalStatement: (statement) => this.evalStatement(statement),
        findCurrentAlgorithm: () => this.findCurrentAlgorithm(),
      },
      this.scope.values,
    );
  }

  private lookup(name: string): GSValue {
    let scope: RuntimeScope | undefined = this.scope;
    while (scope) {
      if (name in scope.values) {
        return scope.values[name];
      }
      scope = scope.parent;
    }
    return undefined;
  }

  private findCurrentAlgorithm(): GSAlgorithm | null {
    for (const algorithm of Object.values(this.algorithms)) {
      return algorithm;
    }
    return null;
  }

  getTrace(name: string): Trace | undefined {
    return this.traces[name];
  }

  runAlgorithm(name: string, args: GSValue[]): GSValue {
    const algorithm = this.algorithms[name];
    if (!algorithm) {
      throw new Error(`Unknown algorithm: ${name}`);
    }

    const newScope = this.createScope();
    for (let i = 0; i < algorithm.params.length; i++) {
      newScope.values[algorithm.params[i]] = args[i];
    }

    const oldScope = this.scope;
    this.scope = newScope;

    for (const stmt of algorithm.body) {
      const result = this.evalStatement(stmt);
      if (stmt.type === 'ReturnStatement') {
        this.scope = oldScope;
        return result;
      }
    }

    this.scope = oldScope;
    return null;
  }
}
