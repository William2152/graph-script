import { SourceLocation } from './common';

export type Expression =
  | Identifier
  | Literal
  | ArrayExpression
  | ObjectExpression
  | TupleExpression
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | ConditionalExpression;

export interface Identifier {
  type: 'Identifier';
  name: string;
  location: SourceLocation;
}

export interface Literal {
  type: 'Literal';
  value: string | number | boolean | null;
  location: SourceLocation;
}

export interface ArrayExpression {
  type: 'ArrayExpression';
  elements: Expression[];
  location: SourceLocation;
}

export interface ObjectExpression {
  type: 'ObjectExpression';
  properties: { key: string; value: Expression }[];
  location: SourceLocation;
}

export interface TupleExpression {
  type: 'TupleExpression';
  elements: Expression[];
  location: SourceLocation;
}

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
  location: SourceLocation;
}

export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: string;
  operand: Expression;
  location: SourceLocation;
}

export interface CallExpression {
  type: 'CallExpression';
  callee: Expression;
  args: Expression[];
  location: SourceLocation;
}

export interface MemberExpression {
  type: 'MemberExpression';
  object: Expression;
  property: string;
  location: SourceLocation;
}

export interface ConditionalExpression {
  type: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
  location: SourceLocation;
}

export type Statement =
  | ExpressionStatement
  | AssignmentStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | EmitStatement;

export interface ExpressionStatement {
  type: 'ExpressionStatement';
  expression: Expression;
  location: SourceLocation;
}

export interface AssignmentStatement {
  type: 'AssignmentStatement';
  target: string;
  value: Expression;
  location: SourceLocation;
}

export interface IfStatement {
  type: 'IfStatement';
  condition: Expression;
  thenBranch: Statement[];
  elseIfBranches?: { condition: Expression; body: Statement[] }[];
  elseBranch?: Statement[];
  location: SourceLocation;
}

export interface WhileStatement {
  type: 'WhileStatement';
  condition: Expression;
  body: Statement[];
  location: SourceLocation;
}

export interface ForStatement {
  type: 'ForStatement';
  variable: string;
  iterable: Expression;
  body: Statement[];
  location: SourceLocation;
}

export interface ReturnStatement {
  type: 'ReturnStatement';
  value?: Expression;
  location: SourceLocation;
}

export interface BreakStatement {
  type: 'BreakStatement';
  location: SourceLocation;
}

export interface ContinueStatement {
  type: 'ContinueStatement';
  location: SourceLocation;
}

export interface EmitStatement {
  type: 'EmitStatement';
  fields: { name: string; value: Expression }[];
  location: SourceLocation;
}
