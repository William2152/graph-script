import {
  Program, TopLevelNode, Expression, Statement, AlgoDeclaration,
  FlowDeclaration, ChartDeclaration, DiagramDeclaration
} from '../ast/types';
import { ScopeManager } from './scope';
import { GSValue, GSFunction, GSAlgorithm, Trace, isTruthy, isEqual, compare } from './values';
import { createBuiltins, createGSFunction } from './builtins';

export class Evaluator {
  private scope: ScopeManager;
  private builtins: Record<string, GSValue>;
  private algorithms: Map<string, GSAlgorithm> = new Map();
  private traces: Map<string, Trace> = new Map();
  private currentAlgo: GSAlgorithm | null = null;

  constructor() {
    this.scope = new ScopeManager();
    this.builtins = createBuiltins();
    for (const [name, fn] of Object.entries(this.builtins)) {
      this.scope.set(name, fn);
    }
  }

  execute(program: Program): Record<string, GSValue> {
    for (const node of program.body) {
      this.executeTopLevel(node);
    }
    return this.scope.getAllValues();
  }

  getTraces(): Map<string, Trace> {
    return this.traces;
  }

  getAlgorithm(name: string): GSAlgorithm | undefined {
    return this.algorithms.get(name);
  }

  private executeTopLevel(node: TopLevelNode): void {
    switch (node.type) {
      case 'UseStatement':
        break;
      case 'ImportStatement':
        break;
      case 'ConstDeclaration':
        this.scope.set(node.name, this.evalExpression(node.value));
        break;
      case 'DataDeclaration':
        for (const binding of node.bindings) {
          const value = this.evalExpression(binding.value);
          this.scope.set(binding.name, value);
          if (value && typeof value === 'object' && (value as any).type === 'algorithm') {
            this.runAlgorithm(value as GSAlgorithm, []);
          }
        }
        break;
      case 'FuncDeclaration':
        this.scope.set(node.name, createGSFunction(node.params, node.body, this.scope.getAllValues()));
        break;
      case 'ThemeDeclaration':
      case 'StyleDeclaration':
      case 'ChartDeclaration':
      case 'FlowDeclaration':
      case 'DiagramDeclaration':
      case 'TableDeclaration':
      case 'Plot3dDeclaration':
      case 'Scene3dDeclaration':
      case 'ErdDeclaration':
      case 'InfraDeclaration':
      case 'PageDeclaration':
        this.scope.set((node as any).name, { ...node });
        break;
      case 'RenderDeclaration':
        break;
      case 'SubDeclaration':
        this.scope.set(node.name, createGSFunction(node.params, node.body, this.scope.getAllValues()));
        break;
      case 'ComponentDeclaration':
        break;
      case 'AlgoDeclaration':
        const algo: GSAlgorithm = {
          type: 'algorithm',
          name: node.name,
          params: node.params,
          body: node.body,
          trace: { type: 'trace', columns: [], rows: [] }
        };
        this.algorithms.set(node.name, algo);
        this.traces.set(node.name, algo.trace);
        this.scope.set(node.name, algo);
        break;
    }
  }

  private evalExpression(expr: Expression): GSValue {
    if (!expr || !expr.type) return null;

    switch (expr.type) {
      case 'Literal':
        return expr.value;
      case 'Identifier':
        const val = this.scope.get(expr.name);
        return val ?? null;
      case 'BinaryExpression':
        return this.evalBinary(expr);
      case 'UnaryExpression':
        return this.evalUnary(expr);
      case 'CallExpression':
        return this.evalCall(expr);
      case 'MemberExpression':
        return this.evalMember(expr);
      case 'IndexExpression':
        return this.evalIndex(expr);
      case 'ArrayExpression':
        return expr.elements.map(e => this.evalExpression(e));
      case 'ObjectExpression':
        const obj: Record<string, GSValue> = {};
        for (const prop of expr.properties) {
          obj[prop.key] = this.evalExpression(prop.value);
        }
        return obj;
      case 'ConditionalExpression':
        return isTruthy(this.evalExpression(expr.test))
          ? this.evalExpression(expr.consequent)
          : this.evalExpression(expr.alternate);
      default:
        return null;
    }
  }

  private evalBinary(expr: Expression & { operator: string; left: Expression; right: Expression }): GSValue {
    const left = this.evalExpression(expr.left);
    const right = this.evalExpression(expr.right);
    const op = expr.operator;

    switch (op) {
      case '+': return (left as number) + (right as number);
      case '-': return (left as number) - (right as number);
      case '*': return (left as number) * (right as number);
      case '/': return (left as number) / (right as number);
      case '%': return (left as number) % (right as number);
      case '^': return Math.pow(left as number, right as number);
      case '==':
      case '===':
        return isEqual(left, right);
      case '!=':
      case '!==':
        return !isEqual(left, right);
      case '<': return compare(left, right, '<');
      case '>': return compare(left, right, '>');
      case '<=': return compare(left, right, '<=');
      case '>=': return compare(left, right, '>=');
      case '&&': return isTruthy(left) && isTruthy(right);
      case '||': return isTruthy(left) || isTruthy(right);
      default: return null;
    }
  }

  private evalUnary(expr: Expression & { operator: string; operand: Expression }): GSValue {
    const operand = this.evalExpression(expr.operand);
    switch (expr.operator) {
      case '-': return -(operand as number);
      case 'not': return !isTruthy(operand);
      default: return null;
    }
  }

  private evalCall(expr: Expression & { callee: Expression | string; args: Expression[] }): GSValue {
    const callee = typeof expr.callee === 'string' ? expr.callee : (expr.callee as Expression & { name: string }).name;
    const fn = this.scope.get(callee);
    const args = expr.args.map(a => this.evalExpression(a));

    if (fn && typeof fn === 'object' && !Array.isArray(fn) && (fn as any).type === 'function') {
      return this.runFunction(fn as GSFunction, args);
    }

    if (fn && typeof fn === 'object' && !Array.isArray(fn) && (fn as any).type === 'algorithm') {
      return this.runAlgorithm(fn as GSAlgorithm, args);
    }

    if (typeof fn === 'function') {
      return fn(...args);
    }

    return null;
  }

  private evalMember(expr: Expression & { object: Expression; property: string }): GSValue {
    const obj = this.evalExpression(expr.object);
    if (typeof obj === 'object' && obj !== null) {
      return (obj as any)[expr.property];
    }
    return null;
  }

  private evalIndex(expr: Expression & { object: Expression; index: Expression }): GSValue {
    const obj = this.evalExpression(expr.object);
    const index = this.evalExpression(expr.index);
    if (Array.isArray(obj)) {
      return obj[index as number];
    }
    if (typeof obj === 'string') {
      return obj.charAt(index as number);
    }
    if (typeof obj === 'object' && obj !== null) {
      return (obj as any)[String(index)];
    }
    return null;
  }

  private runFunction(fn: GSFunction, args: GSValue[]): GSValue {
    const oldScope = this.scope.getCurrentScope();
    const newScope = this.scope.createScope(oldScope);

    for (let i = 0; i < fn.params.length; i++) {
      newScope.values[fn.params[i]] = args[i];
    }

    for (const key of Object.keys(fn.closure)) {
      if (!(key in newScope.values)) {
        newScope.values[key] = fn.closure[key];
      }
    }

    this.scope.pushScope(newScope);
    let result: GSValue = null;

    for (const stmt of fn.body) {
      result = this.evalStatement(stmt);
      if (stmt.type === 'ReturnStatement') break;
    }

    this.scope.popScope();
    return result;
  }

  private runAlgorithm(algo: GSAlgorithm, args: GSValue[]): GSValue {
    const oldScope = this.scope.getCurrentScope();
    const newScope = this.scope.createScope(oldScope);

    for (let i = 0; i < algo.params.length; i++) {
      newScope.values[algo.params[i]] = args[i];
    }

    const oldAlgo = this.currentAlgo;
    this.currentAlgo = algo;

    this.scope.pushScope(newScope);
    let result: GSValue = null;

    for (const stmt of algo.body) {
      result = this.evalStatement(stmt);
      if (stmt.type === 'ReturnStatement') break;
    }

    this.scope.popScope();
    this.currentAlgo = oldAlgo;

    return result;
  }

  private evalStatement(stmt: Statement): GSValue {
    switch (stmt.type) {
      case 'ExpressionStatement':
        return this.evalExpression(stmt.expression);
      case 'AssignmentStatement':
        this.scope.set(stmt.target, this.evalExpression(stmt.value));
        return null;
      case 'IfStatement':
        return this.evalIfStatement(stmt);
      case 'WhileStatement':
        return this.evalWhileStatement(stmt);
      case 'ForStatement':
        return this.evalForStatement(stmt);
      case 'ReturnStatement':
        return stmt.value ? this.evalExpression(stmt.value) : null;
      case 'BreakStatement':
        return { type: 'break' };
      case 'ContinueStatement':
        return { type: 'continue' };
      case 'EmitStatement':
        return this.evalEmitStatement(stmt);
      default:
        return null;
    }
  }

  private evalIfStatement(stmt: Statement & {
    condition: Expression;
    thenBranch: Statement[];
    elseIfBranches?: { condition: Expression; body: Statement[] }[];
    elseBranch?: Statement[];
  }): GSValue {
    if (isTruthy(this.evalExpression(stmt.condition))) {
      return this.evalBlock(stmt.thenBranch);
    }

    if (stmt.elseIfBranches) {
      for (const eb of stmt.elseIfBranches) {
        if (isTruthy(this.evalExpression(eb.condition))) {
          return this.evalBlock(eb.body);
        }
      }
    }

    if (stmt.elseBranch) {
      return this.evalBlock(stmt.elseBranch);
    }

    return null;
  }

  private evalWhileStatement(stmt: Statement & { condition: Expression; body: Statement[] }): GSValue {
    while (isTruthy(this.evalExpression(stmt.condition))) {
      const result = this.evalBlock(stmt.body);
      if (result && (result as any).type === 'break') return null;
      if (result && (result as any).type === 'continue') continue;
      if (result !== null) return result;
    }
    return null;
  }

  private evalForStatement(stmt: Statement & { variable: string; iterable: Expression; body: Statement[] }): GSValue {
    const iter = this.evalExpression(stmt.iterable);
    if (!Array.isArray(iter)) return null;

    for (const item of iter) {
      this.scope.set(stmt.variable, item);
      const result = this.evalBlock(stmt.body);
      if (result && (result as any).type === 'break') return null;
      if (result && (result as any).type === 'continue') continue;
      if (result !== null) return result;
    }
    return null;
  }

  private evalEmitStatement(stmt: Statement & { fields: { name: string; value: Expression }[] }): GSValue {
    const algo = this.currentAlgo;
    if (!algo) return null;

    const row: Record<string, GSValue> = {};
    for (const field of stmt.fields) {
      row[field.name] = this.evalExpression(field.value);
    }

    if (algo.trace.columns.length === 0) {
      algo.trace.columns = stmt.fields.map(f => f.name);
    }
    algo.trace.rows.push(row);

    return null;
  }

  private evalBlock(statements: Statement[]): GSValue {
    for (const stmt of statements) {
      const result = this.evalStatement(stmt);
      if (stmt.type === 'ReturnStatement' || stmt.type === 'BreakStatement' || stmt.type === 'ContinueStatement') {
        return result;
      }
      if (result !== null) return result;
    }
    return null;
  }
}
