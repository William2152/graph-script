import { SourceLocation } from './common';

export type Expression =
  | Identifier
  | Literal
  | ArrayExpression
  | ObjectExpression
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MemberExpression
  | IndexExpression
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
  callee: Expression | string;
  args: Expression[];
  location: SourceLocation;
}

export interface MemberExpression {
  type: 'MemberExpression';
  object: Expression;
  property: string;
  location: SourceLocation;
}

export interface IndexExpression {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
  location: SourceLocation;
}

export interface ConditionalExpression {
  type: 'ConditionalExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
  location: SourceLocation;
}
